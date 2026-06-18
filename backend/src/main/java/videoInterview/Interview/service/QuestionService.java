package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import videoInterview.Interview.dto.question.CreateQuestionRequest;
import videoInterview.Interview.dto.question.QuestionResponse;
import videoInterview.Interview.dto.question.TestCaseRequest;
import videoInterview.Interview.entity.Question;
import videoInterview.Interview.entity.TestCase;
import videoInterview.Interview.entity.User;
import videoInterview.Interview.repository.QuestionRepository;
// import videoInterview.Interview.repository.TestCaseRepository;
import videoInterview.Interview.repository.UserRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    // private final TestCaseRepository testCaseRepository;
    private final UserRepository userRepository;

    // ─── Create Question ──────────────────────────────────────────────────────

    @Transactional
    public QuestionResponse createQuestion(String interviewerId, CreateQuestionRequest request) {

        // 1. Load interviewer
        User interviewer = userRepository.findById(interviewerId)
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        // 2. Build question
        Question question = Question.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .difficulty(Question.Difficulty.valueOf(request.getDifficulty().toUpperCase()))
                .starterCode(request.getStarterCode())
                .tags(request.getTags())
                .createdBy(interviewer)
                .build();

        // 3. Attach test cases if provided
        if (request.getTestCases() != null && !request.getTestCases().isEmpty()) {
            List<TestCase> testCases = request.getTestCases()
                    .stream()
                    .map(tc -> TestCase.builder()
                            .question(question)
                            .input(tc.getInput())
                            .expectedOutput(tc.getExpectedOutput())
                            .hidden(tc.isHidden())
                            .build())
                    .collect(Collectors.toList());

            question.getTestCases().addAll(testCases);
        }

        questionRepository.save(question);

        return toResponse(question);
    }

    // ─── Get Question by ID (with test cases) ─────────────────────────────────

    public QuestionResponse getQuestion(String questionId) {
        Question question = questionRepository.findByIdWithTestCases(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));
        return toResponse(question);
    }

    // ─── Get all Questions ────────────────────────────────────────────────────

    public List<QuestionResponse> getAllQuestions() {
        return questionRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Filter by Difficulty ─────────────────────────────────────────────────

    public List<QuestionResponse> getByDifficulty(String difficulty) {
        return questionRepository
                .findByDifficulty(Question.Difficulty.valueOf(difficulty.toUpperCase()))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Search by Title ──────────────────────────────────────────────────────

    public List<QuestionResponse> search(String keyword) {
        return questionRepository
                .findByTitleContainingIgnoreCase(keyword)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Search by Tag ────────────────────────────────────────────────────────

    public List<QuestionResponse> getByTag(String tag) {
        return questionRepository
                .findByTag(tag)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Add Test Case to existing Question ───────────────────────────────────

    @Transactional
    public QuestionResponse addTestCase(String questionId, TestCaseRequest request) {
        Question question = questionRepository.findByIdWithTestCases(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        TestCase testCase = TestCase.builder()
                .question(question)
                .input(request.getInput())
                .expectedOutput(request.getExpectedOutput())
                .hidden(request.isHidden())
                .build();

        question.getTestCases().add(testCase);
        questionRepository.save(question);

        return toResponse(question);
    }

    // ─── Delete Question ──────────────────────────────────────────────────────

    @Transactional
    public void deleteQuestion(String questionId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        // cascade = CascadeType.ALL handles test case deletion automatically
        questionRepository.delete(question);
    }

    // ─── Update Question ──────────────────────────────────────────────────────

    @Transactional
    public QuestionResponse updateQuestion(String questionId, CreateQuestionRequest request) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        question.setTitle(request.getTitle());
        question.setDescription(request.getDescription());
        question.setDifficulty(Question.Difficulty.valueOf(request.getDifficulty().toUpperCase()));
        question.setStarterCode(request.getStarterCode());
        question.setTags(request.getTags());

        questionRepository.save(question);

        return toResponse(question);
    }

    // ─── Map entity to response ───────────────────────────────────────────────

    private QuestionResponse toResponse(Question question) {
        List<QuestionResponse.TestCaseResponse> testCaseResponses = question.getTestCases()
                .stream()
                .map(tc -> QuestionResponse.TestCaseResponse.builder()
                        .id(tc.getId())
                        .input(tc.getInput())
                        .expectedOutput(tc.getExpectedOutput())
                        .hidden(tc.isHidden())
                        .build())
                .collect(Collectors.toList());

        return QuestionResponse.builder()
                .id(question.getId())
                .title(question.getTitle())
                .description(question.getDescription())
                .difficulty(question.getDifficulty().name())
                .starterCode(question.getStarterCode())
                .tags(question.getTags())
                .createdBy(question.getCreatedBy().getName())
                .testCases(testCaseResponses)
                .createdAt(question.getCreatedAt())
                .build();
    }
}