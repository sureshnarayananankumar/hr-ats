package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.config.HrAtsProperties;
import com.businessgateways.hrats.domain.entity.CandidateDocument;
import com.businessgateways.hrats.domain.entity.CandidateProfile;
import com.businessgateways.hrats.domain.entity.DocumentAccessLog;
import com.businessgateways.hrats.domain.enums.Enums.DocumentType;
import com.businessgateways.hrats.dto.CandidateDtos.DocumentResponse;
import com.businessgateways.hrats.repository.CandidateDocumentRepository;
import com.businessgateways.hrats.repository.CandidateProfileRepository;
import com.businessgateways.hrats.repository.DocumentAccessLogRepository;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.security.Permissions;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Candidate document storage.
 *
 * Several things have to be true at once for this to be safe:
 *
 * <ul>
 *   <li><b>The stored name is never the uploaded name.</b> Files are
 *       written under a generated key, so a name like
 *       {@code ../../etc/passwd} cannot escape the storage root and a
 *       name like {@code x.pdf.exe} cannot be re-served as something
 *       executable.</li>
 *   <li><b>Content is checked, not just the extension.</b> A file
 *       claiming to be a PDF must actually begin with {@code %PDF}.</li>
 *   <li><b>Downloads are authorised and logged.</b> Documents hold
 *       identity papers and salary history, so every read records who
 *       took it.</li>
 *   <li><b>Deletes are soft.</b> A document attached to an application
 *       is part of the hiring record.</li>
 * </ul>
 */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final CandidateDocumentRepository documents;
    private final CandidateProfileRepository candidates;
    private final DocumentAccessLogRepository accessLogs;
    private final AuditService audit;
    private final HrAtsProperties properties;

    private Path storageRoot;

    public DocumentService(
            CandidateDocumentRepository documents,
            CandidateProfileRepository candidates,
            DocumentAccessLogRepository accessLogs,
            AuditService audit,
            HrAtsProperties properties) {
        this.documents = documents;
        this.candidates = candidates;
        this.accessLogs = accessLogs;
        this.audit = audit;
        this.properties = properties;
    }

    @PostConstruct
    void prepareStorage() {
        storageRoot = Path.of(properties.getStorage().getRoot()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(storageRoot);
            log.info("Document storage ready at {}", storageRoot);
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Could not create the document storage directory at " + storageRoot, ex);
        }
    }

    // -----------------------------------------------------------------
    //  Upload
    // -----------------------------------------------------------------

    @Transactional
    public DocumentResponse upload(
            MultipartFile file,
            String candidateId,
            DocumentType documentType,
            AuthenticatedUser caller) {

        CandidateProfile candidate = resolveCandidate(candidateId, caller);

        validateFile(file);
        byte[] head = readHead(file);
        validateMagicNumber(file, head);

        String checksum = checksumOf(file);

        // An identical file re-uploaded is almost always the candidate
        // clicking twice. Returning the existing row avoids a pile of
        // duplicate versions that all say the same thing.
        var existing = documents.findFirstByChecksumAndCandidateIdAndDeletedAtIsNull(
                checksum, candidate.getId());
        if (existing.isPresent()) {
            log.debug("Upload matched an existing document for candidate {}", candidate.getId());
            return toResponse(existing.get());
        }

        String storageKey = buildStorageKey(candidate.getId(), file.getOriginalFilename());
        Path destination = resolveWithin(storageKey);

        try {
            Files.createDirectories(destination.getParent());
            try (InputStream stream = file.getInputStream()) {
                Files.copy(stream, destination, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "The file could not be stored. Try again.", ex);
        }

        // A new upload of the same type supersedes the previous one,
        // keeping exactly one current document per type while the
        // history stays intact.
        var superseded = documents
                .findFirstByCandidateIdAndDocumentTypeAndIsCurrentTrueAndDeletedAtIsNull(
                        candidate.getId(), documentType);

        CandidateDocument document = new CandidateDocument();
        document.setCandidateId(candidate.getId());
        document.setDocumentType(documentType);
        document.setOriginalName(sanitiseName(file.getOriginalFilename()));
        document.setStorageKey(storageKey);
        document.setMimeType(file.getContentType() == null
                ? "application/octet-stream" : file.getContentType());
        document.setSizeBytes((int) file.getSize());
        document.setChecksum(checksum);
        document.setCurrent(true);
        document.setVersion(superseded.map(previous -> previous.getVersion() + 1).orElse(1));
        superseded.ifPresent(previous -> document.setSupersedesId(previous.getId()));

        documents.save(document);

        superseded.ifPresent(previous -> {
            previous.setCurrent(false);
            documents.save(previous);
        });

        audit.record(caller, Constants.Audit.DOCUMENT_UPLOADED, "document", document.getId(),
                Map.of("candidateId", candidate.getId(),
                        "type", documentType.name(),
                        "sizeBytes", file.getSize()));

        return toResponse(document);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose a file to upload.");
        }

        long limit = properties.getStorage().getMaxUploadBytes();
        if (file.getSize() > limit) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "That file is larger than the " + (limit / 1024 / 1024) + " MB limit.");
        }

        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("That file has no name.");
        }

        // Checked against every dot-segment, not just the last one, so
        // "cv.pdf.exe" and "cv.exe.pdf" are both rejected.
        String lower = name.toLowerCase(Locale.ROOT);
        for (String blocked : Constants.BLOCKED_UPLOAD_EXTENSIONS) {
            if (lower.endsWith(blocked) || lower.contains(blocked + ".")) {
                throw ApiException.badRequest(
                        "Files of type " + blocked + " are not accepted. "
                                + "Upload a PDF or Word document.");
            }
        }

        List<String> allowed = properties.getStorage().getAllowedMimeTypes();
        if (!allowed.isEmpty() && !allowed.contains(file.getContentType())) {
            throw ApiException.badRequest(
                    "That file type is not accepted. Upload a PDF or Word document.");
        }
    }

    /**
     * Confirms the bytes match the declared type.
     *
     * The {@code Content-Type} header is supplied by the client and is
     * trivially forged, so the first few bytes are the real check.
     */
    private void validateMagicNumber(MultipartFile file, byte[] head) {
        String mime = file.getContentType() == null ? "" : file.getContentType();

        boolean valid;
        if (mime.equals("application/pdf")) {
            valid = startsWithAny(head, Constants.PDF_MAGIC);
        } else if (mime.contains("openxmlformats")) {
            // .docx is a ZIP container.
            valid = startsWithAny(head, Constants.ZIP_MAGIC);
        } else if (mime.equals("application/msword")) {
            valid = startsWithAny(head, Constants.DOC_MAGIC);
        } else {
            // An accepted type with no signature we know how to check.
            valid = true;
        }

        if (!valid) {
            log.warn("Rejected upload \"{}\": contents do not match the declared type {}",
                    file.getOriginalFilename(), mime);
            throw ApiException.badRequest(
                    "That file's contents do not match its type. It may be damaged.");
        }
    }

    private boolean startsWithAny(byte[] head, List<byte[]> signatures) {
        for (byte[] signature : signatures) {
            if (head.length < signature.length) {
                continue;
            }
            boolean matches = true;
            for (int i = 0; i < signature.length; i++) {
                if (head[i] != signature[i]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return true;
            }
        }
        return false;
    }

    private byte[] readHead(MultipartFile file) {
        try (InputStream stream = file.getInputStream()) {
            return stream.readNBytes(8);
        } catch (IOException ex) {
            throw ApiException.badRequest("That file could not be read.");
        }
    }

    private String checksumOf(MultipartFile file) {
        try (InputStream stream = file.getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "The file could not be processed.", ex);
        }
    }

    // -----------------------------------------------------------------
    //  Download
    // -----------------------------------------------------------------

    /** A document's bytes, with the metadata needed to serve them. */
    public record StoredFile(
            CandidateDocument document, org.springframework.core.io.Resource resource) {}

    @Transactional
    public StoredFile download(String id, AuthenticatedUser caller, HttpServletRequest http) {
        CandidateDocument document = documents.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> ApiException.notFound("Document", id));

        assertCanRead(document, caller);

        Path path = resolveWithin(document.getStorageKey());
        if (!Files.exists(path)) {
            // The row survived but the file did not. Reported as 404
            // rather than 500: nothing the caller does will fix it, and
            // the log has what an operator needs.
            log.error("Document {} is missing from storage at {}", id, path);
            throw ApiException.notFound("That file is no longer available");
        }

        recordAccess(document.getId(), caller.userId(), "DOWNLOAD", http);

        audit.record(caller, Constants.Audit.DOCUMENT_DOWNLOADED, "document", document.getId(),
                Map.of("candidateId", document.getCandidateId(),
                        "type", document.getDocumentType().name()));

        return new StoredFile(document, new org.springframework.core.io.FileSystemResource(path));
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listForCandidate(String candidateId, AuthenticatedUser caller) {
        CandidateProfile candidate = candidates.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("Candidate", candidateId));

        if (!caller.hasPermission(Permissions.DOCUMENT_READ_ANY)
                && !candidate.getUserId().equals(caller.userId())) {
            throw ApiException.notFound("Candidate", candidateId);
        }

        return documents.findByCandidateIdAndDeletedAtIsNullOrderByUploadedAtDesc(candidateId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccessLogEntry> accessLog(String id, AuthenticatedUser caller) {
        documents.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> ApiException.notFound("Document", id));

        return accessLogs.findTop100ByDocumentIdOrderByAccessedAtDesc(id).stream()
                .map(entry -> new AccessLogEntry(
                        entry.getId(), entry.getUserId(), entry.getAction(),
                        entry.getIpAddress(), entry.getAccessedAt()))
                .toList();
    }

    public record AccessLogEntry(
            Long id, String userId, String action, String ipAddress, Instant accessedAt) {}

    /**
     * Marks a document deleted without removing the file.
     *
     * A document attached to an application is part of the hiring
     * record; the retention job is what eventually removes the bytes.
     */
    @Transactional
    public String softDelete(String id, AuthenticatedUser caller, HttpServletRequest http) {
        CandidateDocument document = documents.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> ApiException.notFound("Document", id));

        CandidateProfile candidate = candidates.findById(document.getCandidateId())
                .orElseThrow(() -> ApiException.notFound("Candidate", document.getCandidateId()));

        boolean own = candidate.getUserId().equals(caller.userId());
        if (!own && !caller.hasPermission(Permissions.DOCUMENT_READ_ANY)) {
            throw ApiException.notFound("Document", id);
        }

        document.setDeletedAt(Instant.now());
        document.setCurrent(false);
        documents.save(document);

        recordAccess(document.getId(), caller.userId(), "DELETE", http);
        audit.record(caller, Constants.Audit.DOCUMENT_DELETED, "document", id, null);

        return "The document is removed from your profile.";
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------

    private CandidateProfile resolveCandidate(String candidateId, AuthenticatedUser caller) {
        if (candidateId != null && caller.hasPermission(Permissions.DOCUMENT_READ_ANY)) {
            return candidates.findById(candidateId)
                    .orElseThrow(() -> ApiException.notFound("Candidate", candidateId));
        }

        CandidateProfile own = candidates.findByUserId(caller.userId())
                .orElseThrow(() -> ApiException.badRequest(
                        "This account does not have a candidate profile."));

        if (candidateId != null && !candidateId.equals(own.getId())) {
            audit.recordSecurityEvent(caller, Constants.Audit.DOCUMENT_ACCESS_DENIED,
                    "candidate", candidateId, Map.of("reason", "upload-for-another-candidate"));
            throw ApiException.forbidden("You may only upload documents to your own profile.");
        }

        return own;
    }

    private void assertCanRead(CandidateDocument document, AuthenticatedUser caller) {
        if (caller.hasPermission(Permissions.DOCUMENT_READ_ANY)) {
            return;
        }

        boolean own = candidates.findById(document.getCandidateId())
                .map(candidate -> candidate.getUserId().equals(caller.userId()))
                .orElse(false);

        if (own && caller.hasPermission(Permissions.DOCUMENT_READ_OWN)) {
            return;
        }

        log.warn("User {} was denied access to document {}", caller.userId(), document.getId());
        audit.recordSecurityEvent(caller, Constants.Audit.DOCUMENT_ACCESS_DENIED,
                "document", document.getId(), Map.of("candidateId", document.getCandidateId()));

        throw ApiException.notFound("Document", document.getId());
    }

    private void recordAccess(
            String documentId, String userId, String action, HttpServletRequest http) {
        try {
            DocumentAccessLog entry = new DocumentAccessLog();
            entry.setDocumentId(documentId);
            entry.setUserId(userId);
            entry.setAction(action);
            entry.setIpAddress(http == null ? null : http.getRemoteAddr());
            accessLogs.save(entry);
        } catch (Exception ex) {
            log.error("Could not record access to document {}", documentId, ex);
        }
    }

    /**
     * A storage key built entirely from values we control.
     *
     * Nothing the uploader supplied reaches the path, so there is
     * nothing to traverse with. The date prefix keeps any one directory
     * from accumulating millions of entries.
     */
    private String buildStorageKey(String candidateId, String originalName) {
        LocalDate today = LocalDate.now();
        String extension = extensionOf(originalName);

        return String.format("%d/%02d/%s/%s%s",
                today.getYear(), today.getMonthValue(), candidateId,
                UUID.randomUUID(), extension);
    }

    private String extensionOf(String name) {
        if (name == null) {
            return "";
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        String extension = name.substring(dot).toLowerCase(Locale.ROOT);
        // Only a plain alphanumeric extension is carried over.
        return extension.matches("^\\.[a-z0-9]{1,8}$") ? extension : "";
    }

    private String sanitiseName(String name) {
        if (name == null) {
            return "document";
        }
        // Strip any path the browser included, and anything that would
        // be awkward in a Content-Disposition header.
        String base = name.replaceAll(".*[/\\\\]", "").replaceAll("[\\p{Cntrl}\"]", "");
        return base.length() > 255 ? base.substring(base.length() - 255) : base;
    }

    /**
     * Resolves a key under the storage root, refusing anything that
     * escapes it. Belt and braces: the keys are generated, but a
     * traversal check costs nothing and removes a whole class of bug.
     */
    private Path resolveWithin(String storageKey) {
        Path resolved = storageRoot.resolve(storageKey).normalize();
        if (!resolved.startsWith(storageRoot)) {
            log.error("Refused a storage key that escapes the root: {}", storageKey);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid storage location.");
        }
        return resolved;
    }

    public DocumentResponse toResponse(CandidateDocument document) {
        return new DocumentResponse(
                document.getId(),
                document.getCandidateId(),
                document.getDocumentType(),
                document.getOriginalName(),
                document.getMimeType(),
                document.getSizeBytes(),
                document.getVersion(),
                document.isCurrent(),
                document.getUploadedAt(),
                "/api/documents/" + document.getId() + "/download");
    }
}
