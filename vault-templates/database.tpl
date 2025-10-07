{{- with secret "secret/data/database/postgres" -}}
export DB_PASSWORD="{{ .Data.data.password }}"
export DB_USERNAME="{{ .Data.data.username }}"
{{- end }}