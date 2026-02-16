# Secure Chat Backend (V4)

A high-security, end-to-end encrypted messaging backend built with PHP and MySQL. Designed for enterprise scalability and strict governance.

## 🌟 Key Features (V4)
- **End-to-End Encryption**: Signal Protocol integration (PreKeys, Double Ratchet).
- **Group Management**: Admin roles, invite links, and member management.
- **Forwarding Governance**: Limits viral message spread (Max 5 forwards) and tracks forwarding scores.
- **View Once**: Ephemeral media support with strict access controls.
- **Device Management**: Multi-device support with rigorous trust verification.

## 🚀 Getting Started

### Prerequisites
- PHP 8.0+
- MySQL 8.0+
- Node.js 18+ (for benchmarks/tests)
- Composer

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    composer install
    npm install
    ```
3.  Configure Database:
    - Import schema from `migrations/` in order.
    - Copy `config/db.example.php` to `api/db.php` and set credentials.

### Running Locally
```bash
php -S localhost:8000 -t api/
```

## 🧪 Testing & Benchmarks
- **Unit Tests**: `npm test` (Crypto/Logic invariants).
- **Load Testing**:
    ```bash
    cd benchmark
    node load_generator.js
    ```

## 📂 Project Structure
- `api/`: Public API endpoints (v4/).
- `includes/`: Core logic and helper classes.
- `migrations/`: Database schema version control.
- `benchmark/`: Performance testing harness.

## 🛡️ Security
- **Audit Logs**: All sensitive actions are logged to `security_audit_log`.
- **Rate Limiting**: Token bucket algorithm on all public endpoints.
- **Input Sanitization**: Strict typing and prepared statements everywhere.
