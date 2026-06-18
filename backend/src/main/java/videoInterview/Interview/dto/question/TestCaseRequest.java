package videoInterview.Interview.dto.question;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class TestCaseRequest {
    @NotBlank private String input;
    @NotBlank private String expectedOutput;
    private boolean hidden;
}