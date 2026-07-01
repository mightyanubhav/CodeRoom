package videoInterview.Interview.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import videoInterview.Interview.security.JwtAuthFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthFilter jwtAuthFilter;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(AbstractHttpConfigurer::disable)
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth

                                                // ── Public routes ─────────────────────────────
                                                .requestMatchers(
                                                                "/api/auth/register",
                                                                "/api/auth/login",
                                                                "/api/auth/refresh",
                                                                "/api/rooms/*/joined",
                                                                "/api/rooms/*/left",
                                                                "/api/rooms/*/sync",
                                                                "/api/rooms/*/reset",
                                                                "/api/interviews/by-room-entity/*",
                                                                "/api/interviews/*/room-id",
                                                                "/api/execute",
                                                                "/swagger-ui.html",
                                                                "/swagger-ui/**",
                                                                "/api-docs/**"
                                                ).permitAll()

                                                // ── Admin only ────────────────────────────────
                                                .requestMatchers("/api/admin/**")
                                                .hasRole("ADMIN")

                                                // ── Interviewer only ──────────────────────────
                                                .requestMatchers(
                                                                HttpMethod.POST, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                HttpMethod.PUT, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                HttpMethod.DELETE, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                "/api/interviews/create",
                                                                "/api/ai/**",
                                                                "/api/recordings/**"
                                                ).hasRole("INTERVIEWER")

                                                // ── Everything else needs valid token ─────────
                                                .anyRequest().authenticated()
                                )
                                .exceptionHandling(ex -> ex
                                                // Without this, Spring Security returns 403 for
                                                // unauthenticated requests — the frontend interceptor
                                                // only retries token refresh on 401, so the room
                                                // join flow would break with stale tokens.
                                                .authenticationEntryPoint((request, response, authEx) -> {
                                                        response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                                                        response.setContentType("application/json");
                                                        response.getWriter().write("{\"message\":\"Unauthorized\"}");
                                                })
                                )
                                .addFilterBefore(jwtAuthFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationManager authenticationManager(
                        AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();

                config.setAllowedOrigins(List.of(
                                "http://localhost:5173",
                                "http://localhost:3000",
                                "https://coderoom.vercel.app"
                ));

                config.setAllowedMethods(List.of(
                                "GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/api/**", config);
                return source;
        }
}