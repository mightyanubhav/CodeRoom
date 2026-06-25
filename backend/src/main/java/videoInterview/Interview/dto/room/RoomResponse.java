package videoInterview.Interview.dto.room;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoomResponse {
    private String id;
    private String interviewId;
    private String questionId;
    private String questionTitle;
    private String starterCode;
    private String currentCode;
    private String language;
    private String status;
    private String interviewStatus;   // ← add this
    private Integer participantCount;
    private Integer maxParticipants;
}