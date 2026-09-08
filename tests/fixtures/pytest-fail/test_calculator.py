import pytest
from calculator import add

def test_add_fail():
    assert add(1, 2) == 5