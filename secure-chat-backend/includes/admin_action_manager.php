<?php
// includes/admin_action_manager.php
// Facade for admin actions involving governance.

require_once __DIR__ . '/governance_engine.php';
require_once __DIR__ . '/audit_logger.php';

class AdminActionManager
{
    private $gov;
    private $logger;

    public function __construct($pdo)
    {
        $this->gov = new GovernanceEngine($pdo);
        $this->logger = new AuditLogger($pdo);
    }

    public function request($adminId, $type, $target, $reason)
    {
        $id = $this->gov->requestAction($adminId, $type, $target, $reason);
        $this->logger->log('GOV_REQUEST', 'IMPORTANT', ['request_id' => $id, 'type' => $type, 'admin' => $adminId]);
        return $id;
    }

    public function approve($requestId, $adminId)
    {
        $result = $this->gov->approveAction($requestId, $adminId);
        $this->logger->log('GOV_APPROVE', 'IMPORTANT', ['request_id' => $requestId, 'admin' => $adminId, 'result' => $result]);
        return $result;
    }

    public function reject($requestId, $adminId, $reason)
    {
        $this->gov->rejectAction($requestId, $adminId, $reason);
        $this->logger->log('GOV_REJECT', 'IMPORTANT', ['request_id' => $requestId, 'admin' => $adminId]);
    }

    public function markExecuted($requestId)
    {
        $this->gov->executeAction($requestId);
    }
}
