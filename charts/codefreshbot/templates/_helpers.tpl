{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "codefreshbot.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "codefreshbot.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "codefreshbot.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Putting together required annotations here. These are critical for getting nginx-unterminated calls using
lets encrypt to work at all.
*/}}
{{- define "ingress.required-annotations" -}}
nginx.ingress.kubernetes.io/class: "{{ .Values.ingress.class }}"
nginx.ingress.kubernetes.io/enable-cors: "{{ .Values.ingress.requiredAnnotations.cors.enabled }}"
cert-manager.io/cluster-issuer: "{{ .Values.ingress.requiredAnnotations.certManager.clusterIssuer }}"
{{- if .Values.ingress.requiredAnnotations.acme }}
cert-manager.io/acme-challenge-type: {{ .Values.ingress.requiredAnnotations.certManager.acme.challenge }}
cert-manager.io/acme-dns01-provider: {{ .Values.ingress.requiredAnnotations.certManager.acme.route53 }}
{{- end }}
nginx.kubernetes.io/ingress.force-ssl-redirect: "{{ .Values.ingress.requiredAnnotations.forceSSLRedirect }}"
nginx.kubernetes.io/ingress.allow-http: "{{ .Values.ingress.requiredAnnotations.allowHttp }}"
{{- end -}}