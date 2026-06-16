package videoInterview.Interview.dto.interview;

import lombok.Getter;
import java.time.LocalDateTime;

@Getter
public class CreateInterviewRequest {
    private LocalDateTime scheduledAt;
}