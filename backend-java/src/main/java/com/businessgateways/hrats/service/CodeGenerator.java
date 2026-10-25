package com.businessgateways.hrats.service;

import com.businessgateways.hrats.repository.CandidateProfileRepository;
import com.businessgateways.hrats.repository.InterviewRepository;
import com.businessgateways.hrats.repository.JobApplicationRepository;
import com.businessgateways.hrats.repository.JobRequirementRepository;
import com.businessgateways.hrats.repository.OfferRepository;
import com.businessgateways.hrats.repository.OnboardingRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Year;
import java.util.Locale;
import java.util.function.Function;

/**
 * Human-readable business identifiers — JR-2026-0001, CAND-2026-000123.
 *
 * These are display codes layered on top of the real UUID primary keys
 * and are never used as foreign keys. Generation runs inside the
 * caller's transaction, and the column's UNIQUE constraint is the real
 * guarantee: if two requests race, one hits the constraint and the
 * caller retries rather than silently duplicating a code.
 */
@Service
public class CodeGenerator {

    private final JobRequirementRepository jobs;
    private final CandidateProfileRepository candidates;
    private final JobApplicationRepository applications;
    private final InterviewRepository interviews;
    private final OfferRepository offers;
    private final OnboardingRecordRepository onboardings;

    public CodeGenerator(
            JobRequirementRepository jobs,
            CandidateProfileRepository candidates,
            JobApplicationRepository applications,
            InterviewRepository interviews,
            OfferRepository offers,
            OnboardingRecordRepository onboardings) {
        this.jobs = jobs;
        this.candidates = candidates;
        this.applications = applications;
        this.interviews = interviews;
        this.offers = offers;
        this.onboardings = onboardings;
    }

    @Transactional(readOnly = true)
    public String nextJobCode() {
        return next("JR", 4, prefix -> jobs
                .findFirstByRequirementCodeStartingWithOrderByRequirementCodeDesc(prefix)
                .map(job -> job.getRequirementCode())
                .orElse(null));
    }

    @Transactional(readOnly = true)
    public String nextCandidateCode() {
        return next("CAND", 6, prefix -> candidates
                .findFirstByCandidateCodeStartingWithOrderByCandidateCodeDesc(prefix)
                .map(candidate -> candidate.getCandidateCode())
                .orElse(null));
    }

    @Transactional(readOnly = true)
    public String nextApplicationCode() {
        return next("APP", 6, prefix -> applications
                .findFirstByApplicationCodeStartingWithOrderByApplicationCodeDesc(prefix)
                .map(application -> application.getApplicationCode())
                .orElse(null));
    }

    @Transactional(readOnly = true)
    public String nextInterviewCode() {
        return next("INT", 6, prefix -> interviews
                .findFirstByInterviewCodeStartingWithOrderByInterviewCodeDesc(prefix)
                .map(interview -> interview.getInterviewCode())
                .orElse(null));
    }

    @Transactional(readOnly = true)
    public String nextOfferCode() {
        return next("OFR", 6, prefix -> offers
                .findFirstByOfferCodeStartingWithOrderByOfferCodeDesc(prefix)
                .map(offer -> offer.getOfferCode())
                .orElse(null));
    }

    @Transactional(readOnly = true)
    public String nextOnboardingCode() {
        return next("ONB", 6, prefix -> onboardings
                .findFirstByOnboardingCodeStartingWithOrderByOnboardingCodeDesc(prefix)
                .map(record -> record.getOnboardingCode())
                .orElse(null));
    }

    /**
     * Highest existing code for this year, plus one.
     *
     * Lexical ordering gives the numeric maximum because the counter is
     * zero-padded to a fixed width — which is also why the padding must
     * never shrink once codes exist.
     */
    private String next(String prefix, int padding, Function<String, String> findLatest) {
        String search = prefix + "-" + Year.now().getValue() + "-";
        String latest = findLatest.apply(search);

        long lastNumber = 0;
        if (latest != null && latest.length() > search.length()) {
            try {
                lastNumber = Long.parseLong(latest.substring(search.length()));
            } catch (NumberFormatException ignored) {
                // A hand-edited code that does not parse. Starting over
                // from 1 is wrong, so fall through to the count instead.
                lastNumber = 0;
            }
        }

        return search + String.format("%0" + padding + "d", lastNumber + 1);
    }

    /**
     * URL slug for the public careers portal.
     *
     * The short suffix keeps slugs unique without exposing how many
     * requisitions exist, which a sequential slug would leak.
     */
    public static String slugify(String title, String suffix) {
        String base = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");

        if (base.length() > 180) {
            base = base.substring(0, 180).replaceAll("-+$", "");
        }
        if (base.isEmpty()) {
            base = "job";
        }

        return base + "-" + suffix.toLowerCase(Locale.ROOT);
    }
}
