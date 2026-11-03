"""Create (or reset) a super admin login.

Run from the backend folder, with its own virtual environment:
    .\\.venv\\Scripts\\python.exe create_super_admin.py you@example.com "Your Name"
It asks for the password, so it never ends up in your shell history.
"""
import getpass
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.security import hash_password  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit('Usage: create_super_admin.py <email> ["Full Name"]')
    email = sys.argv[1].strip().lower()
    full_name = sys.argv[2] if len(sys.argv) > 2 else "Super Admin"
    password = os.environ.get("SUPER_ADMIN_PASSWORD")
    if password is None:
        password = getpass.getpass("Password (min 8 characters): ")
        if password != getpass.getpass("Repeat password: "):
            sys.exit("Passwords do not match.")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user is not None and user.role != models.UserRole.SUPER_ADMIN:
            sys.exit(f"{email} already exists as a {user.role.value}. Use a different email for the super admin.")
        if user is None:
            user = models.User(email=email, full_name=full_name, role=models.UserRole.SUPER_ADMIN, hashed_password="", is_verified=True)
            db.add(user)
            action = "Created"
        else:
            action = "Reset password for"
        user.hashed_password = hash_password(password)
        user.is_verified = True
        db.commit()
        print(f"{action} super admin {email}. Sign in at /super-admin/login.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
