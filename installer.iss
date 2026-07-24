; Cafe Bastani - Windows Installer
; نیاز به Inno Setup 6+ دارد

[Setup]
AppId={{CafeBastani-2024-0001}}
AppName=کافه بستنی
AppVersion=1.0.0
AppPublisher=CafeBastani
DefaultDirName={autopf}\CafeBastani
DefaultGroupName=کافه بستنی
OutputDir=installer-output
OutputBaseFilename=CafeBastani-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Cafe Bastani"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{group}\Uninstall Cafe Bastani"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Cafe Bastani"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\setup-venv.bat"; StatusMsg: "Installing Python packages..."; Flags: waituntilterminated shellexec skipifsilent
Filename: "{app}\start.bat"; Description: "Launch Cafe Bastani"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\backend\cafe.db"
Type: filesandordirs; Name: "{app}\backend\cafe_state.json"
Type: filesandordirs; Name: "{app}\backend\backups"
Type: filesandordirs; Name: "{app}\backend\static\products"
Type: filesandordirs; Name: "{app}\backend\venv"
