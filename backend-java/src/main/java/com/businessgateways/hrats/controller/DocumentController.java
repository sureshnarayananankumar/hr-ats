package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.domain.enums.Enums.DocumentType;
import com.businessgateways.hrats.dto.AuthDtos.MessageResponse;
import com.businessgateways.hrats.dto.CandidateDtos.DocumentResponse;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.service.DocumentService;
import com.businessgateways.hrats.service.DocumentService.AccessLogEntry;
import com.businessgateways.hrats.service.DocumentService.StoredFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/** Candidate document upload, download and access history. */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/documents")
@Tag(name = "Documents", description = "Secure candidate document storage")
public class DocumentController {

    private final DocumentService documents;

    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('document.upload.own', 'document.read.any')")
    @Operation(summary = "Upload a candidate document")
    public DocumentResponse upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String candidateId,
            @RequestParam DocumentType documentType,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return documents.upload(file, candidateId, documentType, caller);
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasAnyAuthority('document.read.any', 'document.read.own')")
    @Operation(summary = "List a candidate's documents")
    public List<DocumentResponse> forCandidate(
            @PathVariable String candidateId,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return documents.listForCandidate(candidateId, caller);
    }

    /**
     * Streams a document back.
     *
     * Served as an attachment with an explicit content type and
     * {@code X-Content-Type-Options: nosniff}, so a stored file can
     * never be rendered as script on this origin.
     */
    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyAuthority('document.read.any', 'document.read.own')")
    @Operation(summary = "Download a document")
    public ResponseEntity<Resource> download(
            @PathVariable String id,
            @AuthenticationPrincipal AuthenticatedUser caller,
            HttpServletRequest http) {

        StoredFile stored = documents.download(id, caller, http);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(stored.document().getMimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(stored.document().getOriginalName())
                                .build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentLength(stored.document().getSizeBytes())
                .body(stored.resource());
    }

    @GetMapping("/{id}/access-log")
    @PreAuthorize("hasAuthority('audit.read')")
    @Operation(summary = "Who has opened this document")
    public List<AccessLogEntry> accessLog(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return documents.accessLog(id, caller);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('document.delete.own', 'document.read.any')")
    @Operation(summary = "Remove a document from a profile")
    public MessageResponse delete(
            @PathVariable String id,
            @AuthenticationPrincipal AuthenticatedUser caller,
            HttpServletRequest http) {
        return MessageResponse.of(documents.softDelete(id, caller, http));
    }
}
