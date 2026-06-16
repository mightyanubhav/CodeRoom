# CodeRoom


for phase 1 process that we have completed : 

security/
  JwtUtil.java          → generates and validates JWT tokens
  JwtAuthFilter.java    → runs on every request, reads the token

config/
  SecurityConfig.java   → defines public vs protected routes, BCrypt bean

entity/
  User.java             → maps to users table in Neon
  Interview.java        → maps to interviews table in Neon

repository/
  UserRepository.java        → queries on users table
  InterviewRepository.java   → queries on interviews table

service/
  AuthService.java           → register, login, refresh logic
  InterviewService.java      → create, join, end, score logic

controller/
  AuthController.java        → /api/auth/**
  InterviewController.java   → /api/interviews/**

dto/
  RegisterRequest.java       → incoming register body
  LoginRequest.java          → incoming login body
  AuthResponse.java          → outgoing token response
  interview/
    CreateInterviewRequest   → incoming create body
    ScoreRequest             → incoming score body
    InterviewResponse        → outgoing interview data


    