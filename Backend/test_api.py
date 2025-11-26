"""Quick test script to verify API endpoints are working"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_root():
    """Test root endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"[OK] Root endpoint: {response.status_code} - {response.json()}")
        return True
    except Exception as e:
        print(f"[FAIL] Root endpoint failed: {e}")
        return False

def test_signup():
    """Test signup endpoint"""
    try:
        data = {
            "student_id": "12345678",
            "name": "Test User",
            "password": "testpass123",
            "year": 1
        }
        response = requests.post(f"{BASE_URL}/signup", json=data)
        if response.status_code == 200:
            print(f"[OK] Signup endpoint: {response.status_code} - User created")
        elif response.status_code == 400:
            print(f"[WARN] Signup endpoint: {response.status_code} - {response.json().get('detail', 'User may already exist')}")
        else:
            print(f"[FAIL] Signup endpoint: {response.status_code} - {response.text}")
        return response.status_code in [200, 400]
    except Exception as e:
        print(f"✗ Signup endpoint failed: {e}")
        return False

def test_login():
    """Test login endpoint"""
    try:
        data = {
            "student_id": "12345678",
            "password": "testpass123"
        }
        response = requests.post(f"{BASE_URL}/login", json=data)
        if response.status_code == 200:
            token_data = response.json()
            print(f"[OK] Login endpoint: {response.status_code} - Token received")
            return token_data.get("access_token")
        else:
            print(f"[FAIL] Login endpoint: {response.status_code} - {response.json().get('detail', 'Login failed')}")
            return None
    except Exception as e:
        print(f"✗ Login endpoint failed: {e}")
        return None

def test_me(token):
    """Test /me endpoint"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/me", headers=headers)
        if response.status_code == 200:
            user = response.json()
            print(f"[OK] /me endpoint: {response.status_code} - User: {user.get('name')}")
            return True
        else:
            print(f"[FAIL] /me endpoint: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ /me endpoint failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing API endpoints...\n")
    
    if not test_root():
        print("\n❌ Backend server is not running or not accessible!")
        exit(1)
    
    print()
    test_signup()
    print()
    token = test_login()
    print()
    
    if token:
        test_me(token)
    
    print("\n[OK] API test complete!")

