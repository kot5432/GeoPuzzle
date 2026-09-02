@echo off
set PATH=C:\Program Files\nodejs;C:\Users\kkyog\AppData\Local\pnpm\bin;%PATH%
echo Starting build process...
cd /d C:\Users\kkyog\cousor\GeoPuzzle-fresh
echo Current directory: %CD%
echo Installing root dependencies...
call C:\Users\kkyog\AppData\Local\pnpm\bin\pnpm.CMD install
if errorlevel 1 (
    echo Root install failed
    exit /b 1
)
echo Root install completed
cd artifacts\geo-puzzle
echo Current directory: %CD%
echo Installing geo-puzzle dependencies...
call C:\Users\kkyog\AppData\Local\pnpm\bin\pnpm.CMD install
if errorlevel 1 (
    echo Geo-puzzle install failed
    exit /b 1
)
echo Geo-puzzle install completed
echo Building geo-puzzle...
call C:\Users\kkyog\AppData\Local\pnpm\bin\pnpm.CMD run build
if errorlevel 1 (
    echo Build failed
    exit /b 1
)
echo Geo-puzzle build completed
cd /d C:\Users\kkyog\cousor\GeoPuzzle-fresh
echo Creating public directory...
if not exist public mkdir public
echo Copying files...
xcopy /E /I /Y artifacts\geo-puzzle\dist\public\*.* public\
echo Root build completed successfully
