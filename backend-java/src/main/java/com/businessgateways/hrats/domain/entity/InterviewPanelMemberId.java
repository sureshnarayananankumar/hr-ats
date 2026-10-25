package com.businessgateways.hrats.domain.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite primary key for {@link InterviewPanelMember}. */
public class InterviewPanelMemberId implements Serializable {

    private String interviewId;
    private String interviewerId;

    public InterviewPanelMemberId() {}

    public InterviewPanelMemberId(String interviewId, String interviewerId) {
        this.interviewId = interviewId;
        this.interviewerId = interviewerId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof InterviewPanelMemberId that)) return false;
        return Objects.equals(interviewId, that.interviewId)
                && Objects.equals(interviewerId, that.interviewerId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(interviewId, interviewerId);
    }
}
