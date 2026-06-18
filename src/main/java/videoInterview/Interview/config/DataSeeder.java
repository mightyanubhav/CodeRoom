package videoInterview.Interview.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import videoInterview.Interview.entity.Question;
import videoInterview.Interview.entity.TestCase;
import videoInterview.Interview.entity.User;
import videoInterview.Interview.repository.QuestionRepository;
import videoInterview.Interview.repository.UserRepository;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    @Override
    public void run(String... args) {

        // Only seed if no questions exist
        if (questionRepository.count() > 0) return;

        // Create a system user to own seeded questions
        User system = userRepository.findByEmail("system@coderoom.dev")
                .orElseGet(() -> userRepository.save(
                        User.builder()
                                .name("System")
                                .email("system@coderoom.dev")
                                .password("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
                                .role(User.Role.ADMIN)
                                .build()
                ));

        // ─── Question 1 ───────────────────────────────────────────────────────
        Question twoSum = Question.builder()
                .title("Two Sum")
                .description("Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.")
                .difficulty(Question.Difficulty.EASY)
                .tags("arrays,hashmap")
                .starterCode("class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}")
                .createdBy(system)
                .build();

        twoSum.getTestCases().addAll(java.util.List.of(
                TestCase.builder().question(twoSum).input("[2,7,11,15], 9").expectedOutput("[0,1]").hidden(false).build(),
                TestCase.builder().question(twoSum).input("[3,2,4], 6").expectedOutput("[1,2]").hidden(true).build()
        ));

        // ─── Question 2 ───────────────────────────────────────────────────────
        Question reverseString = Question.builder()
                .title("Reverse String")
                .description("Write a function that reverses a string. The input string is given as an array of characters.")
                .difficulty(Question.Difficulty.EASY)
                .tags("strings,twopointers")
                .starterCode("class Solution {\n    public void reverseString(char[] s) {\n        \n    }\n}")
                .createdBy(system)
                .build();

        reverseString.getTestCases().addAll(java.util.List.of(
                TestCase.builder().question(reverseString).input("[h,e,l,l,o]").expectedOutput("[o,l,l,e,h]").hidden(false).build(),
                TestCase.builder().question(reverseString).input("[H,a,n,n,a,h]").expectedOutput("[h,a,n,n,a,H]").hidden(true).build()
        ));

        // ─── Question 3 ───────────────────────────────────────────────────────
        Question validParentheses = Question.builder()
                .title("Valid Parentheses")
                .description("Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.")
                .difficulty(Question.Difficulty.EASY)
                .tags("stack,strings")
                .starterCode("class Solution {\n    public boolean isValid(String s) {\n        \n    }\n}")
                .createdBy(system)
                .build();

        validParentheses.getTestCases().addAll(java.util.List.of(
                TestCase.builder().question(validParentheses).input("()").expectedOutput("true").hidden(false).build(),
                TestCase.builder().question(validParentheses).input("()[]{}")  .expectedOutput("true").hidden(false).build(),
                TestCase.builder().question(validParentheses).input("(]").expectedOutput("false").hidden(true).build()
        ));

        // ─── Question 4 ───────────────────────────────────────────────────────
        Question maxSubarray = Question.builder()
                .title("Maximum Subarray")
                .description("Given an integer array nums, find the subarray with the largest sum, and return its sum.")
                .difficulty(Question.Difficulty.MEDIUM)
                .tags("arrays,dynamicprogramming,divideandconquer")
                .starterCode("class Solution {\n    public int maxSubArray(int[] nums) {\n        \n    }\n}")
                .createdBy(system)
                .build();

        maxSubarray.getTestCases().addAll(java.util.List.of(
                TestCase.builder().question(maxSubarray).input("[-2,1,-3,4,-1,2,1,-5,4]").expectedOutput("6").hidden(false).build(),
                TestCase.builder().question(maxSubarray).input("[1]").expectedOutput("1").hidden(true).build()
        ));

        // ─── Question 5 ───────────────────────────────────────────────────────
        Question climbStairs = Question.builder()
                .title("Climbing Stairs")
                .description("You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?")
                .difficulty(Question.Difficulty.EASY)
                .tags("dynamicprogramming,math")
                .starterCode("class Solution {\n    public int climbStairs(int n) {\n        \n    }\n}")
                .createdBy(system)
                .build();

        climbStairs.getTestCases().addAll(java.util.List.of(
                TestCase.builder().question(climbStairs).input("2").expectedOutput("2").hidden(false).build(),
                TestCase.builder().question(climbStairs).input("3").expectedOutput("3").hidden(true).build()
        ));

        questionRepository.saveAll(java.util.List.of(
                twoSum, reverseString, validParentheses, maxSubarray, climbStairs
        ));

        System.out.println("✅ Seeded 5 starter questions");
    }
}