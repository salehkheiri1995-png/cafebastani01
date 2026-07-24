; Cafe Bastani - Windows Installer
; Requires Inno Setup 6+

[Setup]
AppId={{CafeBastani-2024-0001}}
AppName=Cafe Bastani
AppVersion=1.0.0
AppPublisher=CafeBastani
DefaultDirName={autopf}\CafeBastani
DefaultGroupName=Cafe Bastani
OutputDir=installer-output
OutputBaseFilename=CafeBastani-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Cafe Bastani"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{group}\Uninstall Cafe Bastani"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Cafe Bastani"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\start.bat"; Description: "Launch Cafe Bastani"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\cafe.db"
Type: filesandordirs; Name: "{app}\cafe_state.json"
Type: filesandordirs; Name: "{app}\static\products"
Type: filesandordirs; Name: "{app}\backups"
