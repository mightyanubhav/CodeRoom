package videoInterview.Interview.dto.interview;

import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter
@Builder
public class InterviewResponse {
    private String id;
    private String roomId;
    private String status;
    private LocalDateTime scheduledAt;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private Integer score;
    private String notes;
    private String interviewerName;
    private String candidateName;
    private String createdById;      // ← lead interviewer's user ID
    private String recordingUrl;     // ← R2 recording URL
}