package videoInterview.Interview.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "test_cases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    // Input fed to the code
    @Column(nullable = false, columnDefinition = "TEXT")
    private String input;

    // Expected output to compare against
    @Column(name = "expected_output", nullable = false, columnDefinition = "TEXT")
    private String expectedOutput;

    // Hidden test cases not shown to candidate
    @Column(name = "is_hidden")
    private boolean hidden;
}