package videoInterview.Interview.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Extract Authorization header
        String authHeader = request.getHeader("Authorization");

        // 2. If no token, skip — SecurityConfig will decide if route needs auth
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Strip "Bearer " prefix and get raw token
        String token = authHeader.substring(7);

        // 4. Validate token — if invalid, skip setting auth and continue the chain.
        // Spring Security's authorization rules will block protected routes.
        // permitAll() routes (e.g. /api/execute) must still be reachable with
        // a stale socket token after a client-side refresh.
        if (!jwtUtil.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 5. Extract claims
        String userId = jwtUtil.extractUserId(token);
        String role = jwtUtil.extractRole(token);

        // 6. Build Spring Security authentication object
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        userId,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );

        // 7. Set into SecurityContext — Spring now knows who this user is
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 8. Continue to the actual controller
        filterChain.doFilter(request, response);
    }
}