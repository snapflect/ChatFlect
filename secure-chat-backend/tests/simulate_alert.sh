#!/bin/bash
# tests/simulate_alert.sh
# Epic 97: Trigger Alerts for Validation

echo "🚨 Simulating Critical Alert Scenario..."

# Scenario 1: Metrics Endpoint Failure
# Since we can't easily kill the pod from inside without kubectl permissions in this script context,
# we will simulate a "Down" state by returning a failure code in a temp file or just guiding the user.

echo "Scenario: Service Down"
echo "Action: Manual intervention required."
echo ""
echo "To trigger 'TargetDown' in Prometheus:"
echo "1. Run: kubectl scale deployment chatflect-backend-staging --replicas=0"
echo "2. Wait 2 minutes (Prometheus Evaluation Period)."
echo "3. Check AlertManager for 'InstanceDown' alert."
echo ""
echo "To trigger 'HighErrorRate' (Simulated):"
echo "1. We will inject a fault marker (Conceptual)."
echo "   (In a real scenario, we might dd-os a specific endpoint to cause 500s)"

echo "ℹ️  This script is a guidance tool for Ops Drills."
