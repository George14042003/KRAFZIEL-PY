import os
import smtplib
from html import escape
from email.message import EmailMessage

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", SMTP_USERNAME)
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


def send_email(to: str, subject: str, html_body: str, text_body: str) -> None:
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"[email] SMTP not configured, skipping email to {to}: {subject}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Elzuron <{SMTP_FROM_EMAIL}>"
    msg["To"] = to
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        print(f"[email] Failed to send email to {to}: {exc}")


def _e(value) -> str:
    return escape(str(value), quote=True)


def _button_html(url: str, label: str) -> str:
    return f"""
    <div style="text-align:center;margin:28px 0">
      <a href="{_e(url)}" style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:10px;
      text-decoration:none;font-weight:700;font-size:14px;display:inline-block">{_e(label)}</a>
    </div>
    """


def _wrap_html(body: str) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px;
    background:#f8fafc;border-radius:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="font-weight:800;font-size:20px;color:#0f172a">Elzuron</span>
      </div>
      {body}
    </div>
    """


def send_verification_email(to: str, full_name: str, token: str) -> None:
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Welcome to Elzuron, {_e(full_name)}!</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        You're almost set. Confirm your email address to activate your account.
      </p>
      {_button_html(link, "Confirm Email")}
      <p style="color:#94a3b8;font-size:12px;margin:0">
        This link expires in 24 hours. If you didn't sign up for Elzuron, you can ignore this email.
      </p>
    """)
    text_body = (
        f"Welcome to Elzuron, {full_name}!\n\n"
        f"Confirm your email address to activate your account:\n{link}\n\n"
        "This link expires in 24 hours. If you didn't sign up for Elzuron, you can ignore this email."
    )
    send_email(to, "Confirm your Elzuron account", html, text_body)


def send_interview_invite_email(
    to: str,
    candidate_name: str,
    interview_type: str,
    scheduled_at,
    interviewer_name: str,
    join_url: str | None = None,
) -> None:
    when = scheduled_at.strftime("%A, %B %d, %Y at %I:%M %p UTC")
    type_label = interview_type.replace("_", " ").title()

    if join_url:
        intro = (
            f"You have a <strong>{type_label}</strong> interview scheduled with "
            f"{interviewer_name} on <strong>{when}</strong>. This interview will be "
            "conducted live, over video, right in your browser &mdash; no download needed. "
            "You'll be asked to log in with this email address (create a free account with it if you don't have one yet)."
        )
        button = _button_html(join_url, "Join Video Interview")
        note = (
            "Click the button above at your scheduled time to enter the interview room. "
            "Please make sure your camera and microphone are enabled."
        )
        text_body = (
            f"Hi {candidate_name},\n\n"
            f"You have a {type_label} interview scheduled with {interviewer_name} on {when}.\n\n"
            f"Join the interview here: {join_url}\n\n"
            "No download is needed - open the link at your scheduled time with your camera and "
            "microphone enabled, and log in with this email address (create a free account with it "
            "if you don't have one yet)."
        )
    else:
        intro = (
            f"You have a <strong>{type_label}</strong> interview scheduled with "
            f"{interviewer_name} on <strong>{when}</strong>."
        )
        button = ""
        note = "Our team will reach out with any further details you may need."
        text_body = (
            f"Hi {candidate_name},\n\n"
            f"You have a {type_label} interview scheduled with {interviewer_name} on {when}.\n\n"
            f"{note}"
        )

    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Your interview is scheduled</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        Hi {_e(candidate_name)}, {intro}
      </p>
      {button}
      <p style="color:#94a3b8;font-size:12px;margin:0">{note}</p>
    """)
    send_email(to, f"Your {type_label} Interview is Scheduled - Elzuron", html, text_body)


def send_availability_request_email(
    to: str,
    candidate_name: str,
    interview_type: str,
    scheduled_at,
    interviewer_name: str,
    respond_url: str,
    signup_url: str | None = None,
) -> None:
    when = scheduled_at.strftime("%A, %B %d, %Y at %I:%M %p UTC")
    type_label = interview_type.replace("_", " ").title()
    signup_html = (
        '<p style="color:#475569;font-size:13px;line-height:1.6;margin:16px 0 0">'
        "You don't have an account with this email yet &mdash; create one first, then confirm:</p>"
        + _button_html(signup_url, "Create your free account")
        if signup_url
        else ""
    )
    signup_text = f"\n\nNo account yet? Create one with this email first: {signup_url}" if signup_url else ""

    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Please confirm your availability</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        Hi {_e(candidate_name)}, {_e(interviewer_name)} would like to schedule a
        <strong>{_e(type_label)}</strong> interview with you on <strong>{_e(when)}</strong>.
      </p>
      {signup_html}
      {_button_html(respond_url, "Confirm or Reschedule")}
      <p style="color:#94a3b8;font-size:12px;margin:0">
        Please confirm whether you're available for this time so the interview can be
        locked in. You'll need to log in with this email address (or create a free account with it) to respond. You won't receive the interview link until you've confirmed.
      </p>
    """)
    text_body = (
        f"Hi {candidate_name},\n\n"
        f"{interviewer_name} would like to schedule a {type_label} interview with you on {when}.\n\n"
        f"Please confirm your availability here: {respond_url}\n\n"
        "Log in with this email address (or create a free account with it) to respond. "
        "You won't receive the interview link until you've confirmed."
        f"{signup_text}"
    )
    send_email(to, f"Please confirm: {type_label} Interview - Elzuron", html, text_body)


def send_signup_invite_email(to: str, candidate_name: str, company_name: str, signup_url: str) -> None:
    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Create your Elzuron account</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        Hi {_e(candidate_name)}, {_e(company_name)} uses Elzuron for interviews. Create a free
        account with <strong>this email address</strong> so you can confirm and join your
        interview securely.
      </p>
      {_button_html(signup_url, "Create your free account")}
      <p style="color:#94a3b8;font-size:12px;margin:0">
        Use {to} when signing up &mdash; interview links only work for the email they were sent to.
      </p>
    """)
    text_body = (
        f"Hi {candidate_name},\n\n"
        f"{company_name} uses Elzuron for interviews. Create a free account with this email "
        f"address ({to}) so you can confirm and join your interview: {signup_url}"
    )
    send_email(to, f"{company_name} invited you to Elzuron", html, text_body)


def send_application_received_email(to: str, candidate_name: str, job_title: str) -> None:
    link = f"{FRONTEND_URL}/candidate/jobs"
    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Application received</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        Hi {_e(candidate_name)}, we've received your application for <strong>{_e(job_title)}</strong>.
        Our team will review it and follow up with next steps.
      </p>
      {_button_html(link, "Track Your Applications")}
      <p style="color:#94a3b8;font-size:12px;margin:0">
        You can check the status of this and any other applications from your Elzuron dashboard
        at any time.
      </p>
    """)
    text_body = (
        f"Hi {candidate_name},\n\n"
        f"We've received your application for {job_title}. Our team will review it and follow "
        "up with next steps.\n\n"
        f"Track your applications here: {link}"
    )
    send_email(to, f"Application received - {job_title}", html, text_body)


def send_password_reset_email(to: str, full_name: str, token: str) -> None:
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    html = _wrap_html(f"""
      <h2 style="color:#0f172a;margin:0 0 12px">Reset your password</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0">
        Hi {_e(full_name)}, we received a request to reset your Elzuron password.
      </p>
      {_button_html(link, "Reset Password")}
      <p style="color:#94a3b8;font-size:12px;margin:0">
        This link expires in 1 hour. If you didn't request this, you can ignore this email.
      </p>
    """)
    text_body = (
        f"Hi {full_name},\n\n"
        f"We received a request to reset your Elzuron password:\n{link}\n\n"
        "This link expires in 1 hour. If you didn't request this, you can ignore this email."
    )
    send_email(to, "Reset your Elzuron password", html, text_body)
