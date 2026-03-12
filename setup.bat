@echo off
echo Installing Node.js dependencies...
call npm install

echo Installing Python dependencies...
REM Requires Python 3.9+ to be installed and available in standard Path
python -m pip install -r requirements.txt

echo.
echo Dependencies installed successfully.
echo Please create a .env file and add your ANTHROPIC_API_KEY.
echo To run the application, type: npm start
pause
