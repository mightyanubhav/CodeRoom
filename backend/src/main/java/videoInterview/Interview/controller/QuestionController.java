package videoInterview.Interview.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import videoInterview.Interview.dto.question.CreateQuestionRequest;
import videoInterview.Interview.dto.question.QuestionResponse;
import videoInterview.Interview.dto.question.TestCaseRequest;
import videoInterview.Interview.service.QuestionService;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    // ─── Create Question (INTERVIEWER only) ───────────────────────────────────
    @PostMapping("/create")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<QuestionResponse> create(
            @AuthenticationPrincipal String interviewerId,
            @Valid @RequestBody CreateQuestionRequest request
    ) {
        QuestionResponse response = questionService.createQuestion(interviewerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ─── Get Single Question ──────────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<QuestionResponse> getQuestion(@PathVariable String id) {
        QuestionResponse response = questionService.getQuestion(id);
        return ResponseEntity.ok(response);
    }

    // ─── Get All Questions ────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<QuestionResponse>> getAllQuestions() {
        List<QuestionResponse> response = questionService.getAllQuestions();
        return ResponseEntity.ok(response);
    }

    // ─── Filter by Difficulty ─────────────────────────────────────────────────
    @GetMapping("/difficulty/{difficulty}")
    public ResponseEntity<List<QuestionResponse>> getByDifficulty(
            @PathVariable String difficulty
    ) {
        List<QuestionResponse> response = questionService.getByDifficulty(difficulty);
        return ResponseEntity.ok(response);
    }

    // ─── Search by Title ──────────────────────────────────────────────────────
    @GetMapping("/search")
    public ResponseEntity<List<QuestionResponse>> search(
            @RequestParam String keyword
    ) {
        List<QuestionResponse> response = questionService.search(keyword);
        return ResponseEntity.ok(response);
    }

    // ─── Search by Tag ────────────────────────────────────────────────────────
    @GetMapping("/tag/{tag}")
    public ResponseEntity<List<QuestionResponse>> getByTag(
            @PathVariable String tag
    ) {
        List<QuestionResponse> response = questionService.getByTag(tag);
        return ResponseEntity.ok(response);
    }

    // ─── Add Test Case to Question (INTERVIEWER only) ─────────────────────────
    @PostMapping("/{id}/testcase")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<QuestionResponse> addTestCase(
            @PathVariable String id,
            @Valid @RequestBody TestCaseRequest request
    ) {
        QuestionResponse response = questionService.addTestCase(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ─── Update Question (INTERVIEWER only) ───────────────────────────────────
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<QuestionResponse> update(
            @PathVariable String id,
            @Valid @RequestBody CreateQuestionRequest request
    ) {
        QuestionResponse response = questionService.updateQuestion(id, request);
        return ResponseEntity.ok(response);
    }

    // ─── Delete Question (INTERVIEWER only) ───────────────────────────────────
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        questionService.deleteQuestion(id);
        return ResponseEntity.noContent().build();
    }
}