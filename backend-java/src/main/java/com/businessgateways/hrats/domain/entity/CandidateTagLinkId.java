package com.businessgateways.hrats.domain.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite primary key for {@link CandidateTagLink}. */
public class CandidateTagLinkId implements Serializable {

    private String candidateId;
    private String tagId;

    public CandidateTagLinkId() {}

    public CandidateTagLinkId(String candidateId, String tagId) {
        this.candidateId = candidateId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof CandidateTagLinkId that)) return false;
        return Objects.equals(candidateId, that.candidateId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(candidateId, tagId);
    }
}
