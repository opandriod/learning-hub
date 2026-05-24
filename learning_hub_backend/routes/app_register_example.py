from flask import Flask
from admin_routes import admin_bp
from notes_routes import notes_bp
from project_routes import project_bp

app = Flask(__name__)
app.register_blueprint(admin_bp)
app.register_blueprint(notes_bp)
app.register_blueprint(project_bp)

if __name__ == "__main__":
    app.run(debug=True)
