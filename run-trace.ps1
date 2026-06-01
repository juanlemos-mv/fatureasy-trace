param(
    [int]$Port = 8088,
    [switch]$SkipBuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$JarPath = Join-Path $ProjectRoot 'trace-app\target\trace-app-0.0.1-SNAPSHOT.jar'
$LogDirectory = Join-Path $ProjectRoot 'trace-app\target'
$OutputLog = Join-Path $LogDirectory 'local-server.out.log'
$ErrorLog = Join-Path $LogDirectory 'local-server.err.log'

function Get-FatureasyTraceServerProcess {
    $processes = @()

    try {
        $jpsOutput = @(jps -lv 2>$null)

        foreach ($line in $jpsOutput) {
            if ($line -match '^(\d+)\s+(.*)$') {
                $processId = [int]$Matches[1]
                $commandLine = $Matches[2]

                if (Test-FatureasyTraceCommand -CommandLine $commandLine) {
                    $processes += [pscustomobject]@{
                        ProcessId = $processId
                        CommandLine = $commandLine
                    }
                }
            }
        }
    } catch {
    }

    try {
        $processes += Get-CimInstance Win32_Process | Where-Object {
            $_.Name -like 'java*' -and (Test-FatureasyTraceCommand -CommandLine $_.CommandLine)
        } | ForEach-Object {
            [pscustomobject]@{
                ProcessId = $_.ProcessId
                CommandLine = $_.CommandLine
            }
        }
    } catch {
    }

    try {
        $netstatOutput = @(netstat -ano -p tcp)

        foreach ($line in $netstatOutput) {
            if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
                $processes += [pscustomobject]@{
                    ProcessId = [int]$Matches[1]
                    CommandLine = "porta $Port"
                }
            }
        }
    } catch {
    }

    $processes | Sort-Object ProcessId -Unique
}

function Test-FatureasyTraceCommand {
    param([string]$CommandLine)

    return $CommandLine -and (
        $CommandLine -like '*trace-app-0.0.1-SNAPSHOT.jar*' -or
        ($CommandLine -like '*spring-boot:run*' -and $CommandLine -like '*trace-app*') -or
        $CommandLine -like '*com.mv.trace.app*'
    )
}

function Stop-FatureasyTraceServer {
    $processes = @(Get-FatureasyTraceServerProcess)

    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force
        Write-Host "Servidor parado: $($process.ProcessId)"
    }
}

function Build-FatureasyTrace {
    Set-Location $ProjectRoot
    mvn -pl trace-app -am -DskipTests package

    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao gerar o jar da aplicacao.'
    }
}

function Start-FatureasyTraceServer {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

    $java = (Get-Command java).Source
    $command = "`"$java`" -jar `"$JarPath`" --server.port=$Port 1> `"$OutputLog`" 2> `"$ErrorLog`""
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $env:ComSpec
    $startInfo.Arguments = "/d /s /c `"$command`""
    $startInfo.WorkingDirectory = $ProjectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($startInfo)

    Write-Host "Servidor iniciado: $($process.Id)"
    return $process
}

function Wait-FatureasyTrace {
    param([string]$Url)

    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2

            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

function Open-FatureasyTrace {
    param([string]$Url)

    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    )
    $chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($chrome) {
        Start-Process -FilePath $chrome -ArgumentList $Url
        return
    }

    Start-Process $Url
}

function Start-FatureasyTrace {
    Stop-FatureasyTraceServer

    if (-not $SkipBuild) {
        Build-FatureasyTrace
    }

    Start-FatureasyTraceServer | Out-Null

    $url = "http://localhost:$Port/"

    if (-not (Wait-FatureasyTrace -Url $url)) {
        throw "A aplicacao nao respondeu em $url."
    }

    if (-not $NoBrowser) {
        Open-FatureasyTrace -Url $url
    }

    Write-Host "Aplicacao disponivel em $url"
}

Start-FatureasyTrace
