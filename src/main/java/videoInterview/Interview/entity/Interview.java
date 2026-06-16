package videoInterview.Interview.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "interviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // Interviewer who created this session
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_id", nullable = false)
    private User interviewer;

    // Candidate being interviewed
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id")
    private User candidate;

    // Unique room link — candidate joins via this
    @Column(name = "room_id", nullable = false, unique = true)
    private String roomId;

    // Interview lifecycle
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    // Scheduled time
    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    // When interview actually started
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    // When interview ended
    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    // Overall score given by interviewer
    @Column(name = "score")
    private Integer score;

    // Interviewer notes post session
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Status {
        SCHEDULED,
        IN_PROGRESS,
        COMPLETED,
        REVIEWED,
        CANCELLED
    }
}