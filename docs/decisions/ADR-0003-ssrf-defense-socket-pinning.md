# ADR-0003: Scanner SSRF Defense via Pre-flight DNS, Socket IP Pinning, and Redirect Re-validation

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Zerivex accepts arbitrary user-supplied target URLs to perform security assessments. If the scanner engine performs standard `fetch()` or `http.get()` calls, an attacker can target internal cloud metadata endpoints (`169.254.169.254`), loopback interfaces (`127.0.0.1`, `::1`), private VPC subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), or execute DNS Rebinding TOCTOU attacks where a public IP transitions to a private IP between DNS resolution and socket connection.

## 2. Decision
All outbound scanner traffic must pass through a custom `SafeHttpClient`:

1. **Protocol Allowlist:** Only `http:` and `https:` schemes allowed (reject `file:`, `ftp:`, `gopher:`, etc.).
2. **Port Allowlist:** Standard web ports only: `80`, `443`, `8080`, `8443`.
3. **Pre-flight DNS Resolution:** Query all IPv4 and IPv6 addresses for the target host before any socket is opened.
4. **CIDR Blacklist Validation:** Reject any address falling within loopback, RFC1918, RFC4193, RFC6598 (Carrier-grade NAT), link-local, multicast, or cloud provider metadata IPs.
5. **Socket-Level IP Pinning:** Establish the raw TCP/TLS socket connection directly to the pre-validated IP address while injecting the original `Host` header. This completely neutralizes DNS rebinding.
6. **Chained Redirect Validation:** Never follow HTTP redirects automatically. Each `3xx` response is parsed, and its `Location` header is evaluated through the entire validation pipeline before any subsequent request is dispatched.
7. **Resource Bounds:** Enforce a strict 15-second connect/read timeout and a maximum response body size of 10MB.

## 3. Consequences
- **Positive:** Bulletproof SSRF defense eliminating cloud credential exfiltration, internal network mapping, and DNS rebinding vulnerabilities.
- **Negative:** Requires custom HTTP client implementation rather than relying on high-level libraries like standard `axios` or unconstrained `fetch`.
