{{- with secret "secret/data/database/redis" -}}
export REDIS_PASSWORD="{{ .Data.data.password }}"
{{- end }}