package videoInterview.Interview.dto.question;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import java.util.List;

@Getter
public class CreateQuestionRequest {
    @NotBlank private String title;
    @NotBlank private String description;
    @NotBlank private String difficulty;
    private String starterCode;
    private String tags;
    private List<TestCaseRequest> testCases;
}