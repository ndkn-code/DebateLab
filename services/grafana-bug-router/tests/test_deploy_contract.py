from pathlib import Path


SCRIPT = (Path(__file__).parents[1] / "deploy-gcp.sh").read_text()


def test_push_subscription_ack_deadline_exceeds_worker_timeout() -> None:
    worker_timeout_seconds = 60
    ack_deadline_seconds = 90
    assert SCRIPT.count(f"--ack-deadline {ack_deadline_seconds}") == 2
    assert ack_deadline_seconds > worker_timeout_seconds
    assert f'--timeout {worker_timeout_seconds}s' in SCRIPT
