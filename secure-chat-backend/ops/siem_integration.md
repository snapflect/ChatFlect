# Operations: SIEM Integration Guide
**Epic 98**

## 1. Compliance Logs
- **Source**: `/var/www/html/logs/compliance.json.log`
- **Format**: NDJSON (Newline Delimited JSON)
- **Rotation**: Daily, handled by `logrotate` (or application-level GC).

## 2. Filebeat Configuration (Elastic Stack)
Add this input to your `filebeat.yml` to ship logs to Elasticsearch/Logstash.

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/www/html/logs/compliance.json.log
  json.keys_under_root: true
  json.add_error_key: true
  fields:
    service: chatflect-backend
    env: staging

output.elasticsearch:
  hosts: ["https://es.internal.chatflect.com:9200"]
  username: "filebeat_writer"
  password: "${ES_PASSWORD}"
```

## 3. Fluentd Configuration (Splunk/Generic)
```xml
<source>
  @type tail
  path /var/www/html/logs/compliance.json.log
  pos_file /var/log/td-agent/chatflect.pos
  tag chatflect.audit
  <parse>
    @type json
  </parse>
</source>

<match chatflect.audit>
  @type splunk_hec
  host splunk.internal.chatflect.com
  token "#{ENV['SPLUNK_TOKEN']}"
</match>
```

## 4. Verification
1. Trigger a login failure in the app.
2. Search SIEM for `event_id: "login_failed"`.
