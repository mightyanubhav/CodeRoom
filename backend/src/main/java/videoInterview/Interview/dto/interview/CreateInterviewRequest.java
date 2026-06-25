package videoInterview.Interview.dto.interview;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CreateInterviewRequest {
    private LocalDateTime scheduledAt;
    private Integer maxInterviewers = 1;
}