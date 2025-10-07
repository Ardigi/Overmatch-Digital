# Service Dependency Diagram Generator
# Generates visual dependency diagrams and reports
# Usage: .\generate-dependency-diagram.ps1 [-Format mermaid|plantuml|json|html] [-Output path]

param(
    [ValidateSet("mermaid", "plantuml", "json", "html", "all")]
    [string]$Format = "html",
    [string]$Output = ".",
    [switch]$OpenInBrowser,
    [switch]$IncludeInfra
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Step { Write-Host "`n→ $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $($args[0])" -ForegroundColor Green }
function Write-Info { Write-Host "ℹ $($args[0])" -ForegroundColor Blue }

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║          Service Dependency Diagram Generator               ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Service dependency data
$services = @{
    "auth-service" = @{
        Name = "Auth Service"
        Port = 3001
        Dependencies = @()
        Infrastructure = @("PostgreSQL", "Redis", "Kafka")
        Publishes = @("user.created", "user.updated", "session.created")
        Database = "soc_auth"
    }
    "client-service" = @{
        Name = "Client Service"
        Port = 3002
        Dependencies = @("auth-service")
        Infrastructure = @("PostgreSQL", "Redis", "Kafka")
        Publishes = @("organization.created", "organization.updated")
        Database = "soc_clients"
    }
    "policy-service" = @{
        Name = "Policy Service"
        Port = 3003
        Dependencies = @("client-service")
        Infrastructure = @("PostgreSQL", "Redis", "Kafka")
        Publishes = @("policy.created", "policy.approved")
        Database = "soc_policies"
    }
    "control-service" = @{
        Name = "Control Service"
        Port = 3004
        Dependencies = @("policy-service")
        Infrastructure = @("PostgreSQL", "Redis", "Kafka")
        Publishes = @("control.created", "control.implemented")
        Database = "soc_controls"
    }
    "evidence-service" = @{
        Name = "Evidence Service"
        Port = 3005
        Dependencies = @("control-service", "client-service")
        Infrastructure = @("PostgreSQL", "MongoDB", "Redis", "Kafka")
        Publishes = @("evidence.uploaded", "evidence.verified")
        Database = "soc_evidence"
    }
    "workflow-service" = @{
        Name = "Workflow Service"
        Port = 3006
        Dependencies = @()
        Infrastructure = @("PostgreSQL", "Kafka")
        Publishes = @("workflow.started", "workflow.completed")
        Database = "soc_workflows"
    }
    "reporting-service" = @{
        Name = "Reporting Service"
        Port = 3007
        Dependencies = @("client-service", "policy-service", "control-service", "evidence-service")
        Infrastructure = @("PostgreSQL", "Elasticsearch")
        Publishes = @("report.generated")
        Database = "soc_reporting"
    }
    "audit-service" = @{
        Name = "Audit Service"
        Port = 3008
        Dependencies = @()
        Infrastructure = @("PostgreSQL", "Kafka")
        Subscribes = @("*")
        Database = "soc_audits"
    }
    "integration-service" = @{
        Name = "Integration Service"
        Port = 3009
        Dependencies = @()
        Infrastructure = @("PostgreSQL", "Kafka")
        Publishes = @("integration.synced")
        Database = "soc_integrations"
    }
    "notification-service" = @{
        Name = "Notification Service"
        Port = 3010
        Dependencies = @("auth-service", "client-service")
        Infrastructure = @("PostgreSQL", "Redis", "Kafka")
        Subscribes = @("*.created", "*.updated", "*.completed")
        Database = "soc_notifications"
    }
    "ai-service" = @{
        Name = "AI Service"
        Port = 3011
        Dependencies = @("evidence-service", "control-service")
        Infrastructure = @("PostgreSQL", "MongoDB")
        Publishes = @("ai.recommendation")
        Database = "soc_ai"
    }
}

# Infrastructure services
$infrastructure = @{
    "PostgreSQL" = @{ Port = 5432; Type = "Database" }
    "MongoDB" = @{ Port = 27017; Type = "Database" }
    "Redis" = @{ Port = 6379; Type = "Cache" }
    "Kafka" = @{ Port = 9092; Type = "MessageQueue" }
    "Elasticsearch" = @{ Port = 9200; Type = "Search" }
    "Kong" = @{ Port = 8000; Type = "Gateway" }
}

# Generate Mermaid diagram
function Generate-MermaidDiagram {
    $mermaid = @"
graph TB
    %% API Gateway
    User[User/Browser]
    Kong[Kong API Gateway]
    
    %% Services
"@

    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $id = $key.Replace("-service", "")
        $mermaid += "`n    $id[$($service.Name)<br/>Port: $($service.Port)]"
    }

    if ($IncludeInfra) {
        $mermaid += "`n`n    %% Infrastructure"
        foreach ($key in $infrastructure.Keys) {
            $infra = $infrastructure[$key]
            $id = $key.Replace(" ", "")
            $mermaid += "`n    $id[($key<br/>Port: $($infra.Port))]"
        }
    }

    $mermaid += "`n`n    %% User Flow`n    User --> Kong"

    # Service dependencies
    $mermaid += "`n`n    %% Service Dependencies"
    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $fromId = $key.Replace("-service", "")
        
        foreach ($dep in $service.Dependencies) {
            $toId = $dep.Replace("-service", "")
            $mermaid += "`n    $fromId --> $toId"
        }
    }

    if ($IncludeInfra) {
        $mermaid += "`n`n    %% Infrastructure Dependencies"
        foreach ($key in $services.Keys) {
            $service = $services[$key]
            $serviceId = $key.Replace("-service", "")
            
            foreach ($infra in $service.Infrastructure) {
                $infraId = $infra.Replace(" ", "")
                $mermaid += "`n    $serviceId -.-> $infraId"
            }
        }
    }

    # Styling
    $mermaid += @"

    %% Styling
    classDef serviceNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef infraNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef gatewayNode fill:#fff3e0,stroke:#e65100,stroke-width:3px
"@

    return $mermaid
}

# Generate PlantUML diagram
function Generate-PlantUMLDiagram {
    $plantuml = @"
@startuml
!theme aws-orange
title Service Dependency Diagram

package "API Layer" {
    [Kong API Gateway] as Kong
}

package "Microservices" {
"@

    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $plantuml += "`n    [$($service.Name)] as $key"
    }

    $plantuml += "`n}"

    if ($IncludeInfra) {
        $plantuml += "`n`npackage ""Infrastructure"" {"
        foreach ($key in $infrastructure.Keys) {
            $plantuml += "`n    database ""$key"" as $($key.Replace(' ', ''))"
        }
        $plantuml += "`n}"
    }

    # Dependencies
    foreach ($key in $services.Keys) {
        $service = $services[$key]
        foreach ($dep in $service.Dependencies) {
            $plantuml += "`n$key --> $dep"
        }
    }

    $plantuml += "`n@enduml"
    return $plantuml
}

# Generate JSON structure
function Generate-JSONStructure {
    $jsonData = @{
        services = @()
        infrastructure = @()
        dependencies = @()
    }

    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $jsonData.services += @{
            id = $key
            name = $service.Name
            port = $service.Port
            database = $service.Database
            dependencies = $service.Dependencies
            infrastructure = $service.Infrastructure
            publishes = $service.Publishes
            subscribes = $service.Subscribes
        }

        foreach ($dep in $service.Dependencies) {
            $jsonData.dependencies += @{
                from = $key
                to = $dep
                type = "http"
            }
        }
    }

    if ($IncludeInfra) {
        foreach ($key in $infrastructure.Keys) {
            $infra = $infrastructure[$key]
            $jsonData.infrastructure += @{
                name = $key
                port = $infra.Port
                type = $infra.Type
            }
        }
    }

    return $jsonData | ConvertTo-Json -Depth 10
}

# Generate HTML visualization
function Generate-HTMLVisualization {
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Dependency Map - SOC Compliance Platform</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vis-network@latest/dist/vis-network.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/vis-network@latest/dist/dist/vis-network.min.css" rel="stylesheet" type="text/css" />
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .subtitle {
            margin-top: 10px;
            opacity: 0.9;
        }
        .tabs {
            display: flex;
            background: #f5f5f5;
            border-bottom: 2px solid #ddd;
        }
        .tab {
            padding: 15px 30px;
            cursor: pointer;
            background: transparent;
            border: none;
            font-size: 16px;
            transition: all 0.3s;
        }
        .tab:hover {
            background: #e0e0e0;
        }
        .tab.active {
            background: white;
            border-bottom: 3px solid #667eea;
            font-weight: bold;
        }
        .content {
            padding: 30px;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        #network {
            width: 100%;
            height: 600px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .mermaid {
            text-align: center;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #667eea;
            color: white;
        }
        tr:hover {
            background: #f5f5f5;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            margin: 2px;
        }
        .badge.http { background: #4CAF50; color: white; }
        .badge.event { background: #2196F3; color: white; }
        .badge.database { background: #FF9800; color: white; }
        .badge.cache { background: #9C27B0; color: white; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
        }
        .stat-label {
            margin-top: 5px;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Service Dependency Map</h1>
            <div class="subtitle">SOC Compliance Platform - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('overview')">Overview</button>
            <button class="tab" onclick="showTab('network')">Network Graph</button>
            <button class="tab" onclick="showTab('flow')">Flow Diagram</button>
            <button class="tab" onclick="showTab('matrix')">Dependency Matrix</button>
            <button class="tab" onclick="showTab('details')">Service Details</button>
        </div>
        
        <div class="content">
            <!-- Overview Tab -->
            <div id="overview" class="tab-content active">
                <h2>Platform Overview</h2>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">$($services.Count)</div>
                        <div class="stat-label">Microservices</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">$($infrastructure.Count)</div>
                        <div class="stat-label">Infrastructure Services</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">$(($services.Values | ForEach-Object { $_.Dependencies.Count } | Measure-Object -Sum).Sum)</div>
                        <div class="stat-label">Service Dependencies</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">11</div>
                        <div class="stat-label">Databases</div>
                    </div>
                </div>
                
                <h3>Architecture Summary</h3>
                <p>The SOC Compliance Platform consists of $($services.Count) microservices orchestrated through Kong API Gateway. 
                Services communicate via HTTP REST APIs for synchronous operations and Apache Kafka for asynchronous event-driven workflows.</p>
                
                <h3>Key Components</h3>
                <ul>
                    <li><strong>API Gateway:</strong> Kong (Port 8000) - Central entry point for all API requests</li>
                    <li><strong>Message Bus:</strong> Apache Kafka - Event-driven architecture backbone</li>
                    <li><strong>Databases:</strong> PostgreSQL (primary), MongoDB (documents), Elasticsearch (search)</li>
                    <li><strong>Cache Layer:</strong> Redis - Session management and data caching</li>
                </ul>
            </div>
            
            <!-- Network Graph Tab -->
            <div id="network" class="tab-content">
                <h2>Interactive Network Graph</h2>
                <div id="networkGraph"></div>
            </div>
            
            <!-- Flow Diagram Tab -->
            <div id="flow" class="tab-content">
                <h2>Service Flow Diagram</h2>
                <div class="mermaid">
$(Generate-MermaidDiagram)
                </div>
            </div>
            
            <!-- Matrix Tab -->
            <div id="matrix" class="tab-content">
                <h2>Dependency Matrix</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Port</th>
                            <th>Dependencies</th>
                            <th>Database</th>
                            <th>Infrastructure</th>
                        </tr>
                    </thead>
                    <tbody>
"@

    foreach ($key in $services.Keys | Sort-Object) {
        $service = $services[$key]
        $deps = if ($service.Dependencies.Count -gt 0) { 
            ($service.Dependencies | ForEach-Object { "<span class='badge http'>$_</span>" }) -join " "
        } else { 
            "<em>None</em>" 
        }
        
        $infra = ($service.Infrastructure | ForEach-Object {
            $type = switch ($_) {
                "PostgreSQL" { "database" }
                "MongoDB" { "database" }
                "Redis" { "cache" }
                "Kafka" { "event" }
                "Elasticsearch" { "database" }
                default { "infra" }
            }
            "<span class='badge $type'>$_</span>"
        }) -join " "
        
        $html += @"
                        <tr>
                            <td><strong>$($service.Name)</strong></td>
                            <td>$($service.Port)</td>
                            <td>$deps</td>
                            <td>$($service.Database)</td>
                            <td>$infra</td>
                        </tr>
"@
    }

    $html += @"
                    </tbody>
                </table>
            </div>
            
            <!-- Details Tab -->
            <div id="details" class="tab-content">
                <h2>Service Details</h2>
"@

    foreach ($key in $services.Keys | Sort-Object) {
        $service = $services[$key]
        $html += @"
                <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h3>$($service.Name)</h3>
                    <p><strong>Port:</strong> $($service.Port) | <strong>Database:</strong> $($service.Database)</p>
                    <p><strong>Dependencies:</strong> $(if ($service.Dependencies.Count -gt 0) { $service.Dependencies -join ", " } else { "None" })</p>
                    <p><strong>Infrastructure:</strong> $($service.Infrastructure -join ", ")</p>
                    $(if ($service.Publishes) { "<p><strong>Publishes Events:</strong> $($service.Publishes -join ', ')</p>" })
                    $(if ($service.Subscribes) { "<p><strong>Subscribes to:</strong> $($service.Subscribes -join ', ')</p>" })
                </div>
"@
    }

    $html += @"
            </div>
        </div>
    </div>
    
    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
        
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
            
            // Initialize network graph if needed
            if (tabName === 'network' && !window.networkInitialized) {
                initializeNetwork();
                window.networkInitialized = true;
            }
        }
        
        function initializeNetwork() {
            // Create nodes
            var nodes = new vis.DataSet([
"@

    # Add service nodes
    $nodeId = 1
    $nodeMap = @{}
    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $nodeMap[$key] = $nodeId
        $html += "                { id: $nodeId, label: '$($service.Name)', group: 'service' },`n"
        $nodeId++
    }

    if ($IncludeInfra) {
        foreach ($key in $infrastructure.Keys) {
            $nodeMap[$key] = $nodeId
            $html += "                { id: $nodeId, label: '$key', group: 'infra' },`n"
            $nodeId++
        }
    }

    $html += @"
            ]);
            
            // Create edges
            var edges = new vis.DataSet([
"@

    # Add edges
    $edgeId = 1
    foreach ($key in $services.Keys) {
        $service = $services[$key]
        $fromId = $nodeMap[$key]
        
        foreach ($dep in $service.Dependencies) {
            if ($nodeMap.ContainsKey($dep)) {
                $toId = $nodeMap[$dep]
                $html += "                { from: $fromId, to: $toId, arrows: 'to' },`n"
                $edgeId++
            }
        }
    }

    $html += @"
            ]);
            
            // Create network
            var container = document.getElementById('networkGraph');
            var data = { nodes: nodes, edges: edges };
            var options = {
                groups: {
                    service: { color: { background: '#f3e5f5', border: '#4a148c' }, shape: 'box' },
                    infra: { color: { background: '#e8f5e9', border: '#1b5e20' }, shape: 'database' }
                },
                layout: {
                    hierarchical: {
                        direction: 'UD',
                        sortMethod: 'directed'
                    }
                },
                physics: {
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -8000,
                        springConstant: 0.001
                    }
                }
            };
            
            var network = new vis.Network(container, data, options);
        }
    </script>
</body>
</html>
"@

    return $html
}

# Generate output based on format
Write-Step "Generating dependency diagram in $Format format"

switch ($Format) {
    "mermaid" {
        $content = Generate-MermaidDiagram
        $filename = Join-Path $Output "service-dependencies.mmd"
        $content | Out-File -FilePath $filename -Encoding UTF8
        Write-Success "Generated Mermaid diagram: $filename"
    }
    
    "plantuml" {
        $content = Generate-PlantUMLDiagram
        $filename = Join-Path $Output "service-dependencies.puml"
        $content | Out-File -FilePath $filename -Encoding UTF8
        Write-Success "Generated PlantUML diagram: $filename"
    }
    
    "json" {
        $content = Generate-JSONStructure
        $filename = Join-Path $Output "service-dependencies.json"
        $content | Out-File -FilePath $filename -Encoding UTF8
        Write-Success "Generated JSON structure: $filename"
    }
    
    "html" {
        $content = Generate-HTMLVisualization
        $filename = Join-Path $Output "service-dependencies.html"
        $content | Out-File -FilePath $filename -Encoding UTF8
        Write-Success "Generated HTML visualization: $filename"
        
        if ($OpenInBrowser) {
            Start-Process $filename
        }
    }
    
    "all" {
        Generate-MermaidDiagram | Out-File -FilePath (Join-Path $Output "service-dependencies.mmd") -Encoding UTF8
        Generate-PlantUMLDiagram | Out-File -FilePath (Join-Path $Output "service-dependencies.puml") -Encoding UTF8
        Generate-JSONStructure | Out-File -FilePath (Join-Path $Output "service-dependencies.json") -Encoding UTF8
        Generate-HTMLVisualization | Out-File -FilePath (Join-Path $Output "service-dependencies.html") -Encoding UTF8
        
        Write-Success "Generated all formats in: $Output"
        
        if ($OpenInBrowser) {
            Start-Process (Join-Path $Output "service-dependencies.html")
        }
    }
}

Write-Info "`nDependency analysis complete!"
Write-Host "Files generated in: $Output" -ForegroundColor Cyan