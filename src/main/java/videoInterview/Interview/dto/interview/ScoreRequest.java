package videoInterview.Interview.dto.interview;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class ScoreRequest {
    @NotNull
    @Min(1) @Max(10)
    private Integer score;
    private String notes;
}