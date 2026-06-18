package videoInterview.Interview.dto.question;

import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class QuestionResponse {
    private String id;
    private String title;
    private String description;
    private String difficulty;
    private String starterCode;
    private String tags;
    private String createdBy;
    private List<TestCaseResponse> testCases;
    private LocalDateTime createdAt;

    @Getter
    @Builder
    public static class TestCaseResponse {
        private String id;
        private String input;
        private String expectedOutput;
        private boolean hidden;
    }
}