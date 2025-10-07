{{- with secret "secret/data/application/auth" -}}
export JWT_SECRET="{{ .Data.data.jwt_secret }}"
{{- end }}