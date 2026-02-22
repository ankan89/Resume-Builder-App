import requests
import sys
import json
from datetime import datetime

class ResumeBuilderAPITester:
    def __init__(self, base_url="https://job-match-resume-24.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.resume_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, message="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED - {message}")
        else:
            print(f"❌ {name}: FAILED - {message}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "message": message,
            "response_data": response_data
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                print(f"   Response: {response.text[:200]}...")

            if success:
                self.log_test(name, True, f"Status: {response.status_code}", response_data)
                return True, response_data
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, response_data

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_auth_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "Test123!",
            "full_name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and response:
            self.token = response.get('token')
            if response.get('user'):
                self.user_id = response['user'].get('id')
            return True, test_data
        return False, test_data

    def test_auth_login(self, credentials):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": credentials["email"], "password": credentials["password"]}
        )
        
        if success and response:
            self.token = response.get('token')
            if response.get('user'):
                self.user_id = response['user'].get('id')
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_resume(self):
        """Test resume creation"""
        resume_data = {
            "title": "Software Engineer Resume",
            "template": "modern",
            "sections": [
                {
                    "type": "personal_info",
                    "content": {
                        "name": "John Doe",
                        "email": "john.doe@example.com",
                        "phone": "+1-234-567-8900",
                        "location": "San Francisco, CA"
                    }
                },
                {
                    "type": "summary",
                    "content": "Experienced software engineer with 5+ years in full-stack development"
                },
                {
                    "type": "skills",
                    "content": "JavaScript, Python, React, Node.js, MongoDB, AWS"
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Resume",
            "POST",
            "resumes",
            200,
            data=resume_data
        )
        
        if success and response:
            self.resume_id = response.get('id')
            return True
        return False

    def test_get_resumes(self):
        """Test get user resumes"""
        success, response = self.run_test(
            "Get User Resumes",
            "GET",
            "resumes",
            200
        )
        return success

    def test_get_resume(self):
        """Test get specific resume"""
        if not self.resume_id:
            self.log_test("Get Specific Resume", False, "No resume ID available")
            return False
            
        success, response = self.run_test(
            "Get Specific Resume",
            "GET",
            f"resumes/{self.resume_id}",
            200
        )
        return success

    def test_update_resume(self):
        """Test resume update"""
        if not self.resume_id:
            self.log_test("Update Resume", False, "No resume ID available")
            return False
            
        update_data = {
            "title": "Updated Software Engineer Resume",
            "sections": [
                {
                    "type": "personal_info",
                    "content": {
                        "name": "John Doe Updated",
                        "email": "john.doe.updated@example.com",
                        "phone": "+1-234-567-8900",
                        "location": "San Francisco, CA"
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Update Resume",
            "PUT",
            f"resumes/{self.resume_id}",
            200,
            data=update_data
        )
        return success

    def test_ats_analysis(self):
        """Test ATS analysis"""
        if not self.resume_id:
            self.log_test("ATS Analysis", False, "No resume ID available")
            return False
            
        analysis_data = {
            "resume_id": self.resume_id,
            "job_description": "We are looking for a Senior Software Engineer with expertise in JavaScript, React, and Node.js. Must have 5+ years of experience in full-stack development. Strong knowledge of MongoDB and cloud platforms like AWS required."
        }
        
        success, response = self.run_test(
            "ATS Analysis",
            "POST",
            "ats/analyze",
            200,
            data=analysis_data
        )
        return success

    def test_get_analyses(self):
        """Test get ATS analyses"""
        success, response = self.run_test(
            "Get ATS Analyses",
            "GET",
            "ats/analyses",
            200
        )
        return success

    def test_create_checkout(self):
        """Test payment checkout creation"""
        success, response = self.run_test(
            "Create Payment Checkout",
            "POST",
            "payments/checkout",
            200
        )
        return success

    def test_unauthorized_access(self):
        """Test unauthorized access"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access Test",
            "GET",
            "resumes",
            401
        )
        
        # Restore token
        self.token = temp_token
        return success

def main():
    print("🚀 Starting Resume Builder API Tests")
    print("=" * 50)
    
    tester = ResumeBuilderAPITester()
    
    # Test authentication flow
    print("\n📝 AUTHENTICATION TESTS")
    print("-" * 30)
    
    # Register new user
    reg_success, credentials = tester.test_auth_register()
    if not reg_success:
        print("❌ Registration failed, stopping tests")
        return 1
    
    # Test login with same credentials
    if not tester.test_auth_login(credentials):
        print("❌ Login failed, stopping tests")
        return 1
    
    # Test get current user
    if not tester.test_auth_me():
        print("❌ Get current user failed")
    
    # Test resume operations
    print("\n📄 RESUME TESTS")
    print("-" * 30)
    
    if not tester.test_create_resume():
        print("❌ Resume creation failed")
    
    if not tester.test_get_resumes():
        print("❌ Get resumes failed")
    
    if not tester.test_get_resume():
        print("❌ Get specific resume failed")
    
    if not tester.test_update_resume():
        print("❌ Update resume failed")
    
    # Test ATS analysis
    print("\n🎯 ATS ANALYSIS TESTS")
    print("-" * 30)
    
    if not tester.test_ats_analysis():
        print("❌ ATS analysis failed")
    
    if not tester.test_get_analyses():
        print("❌ Get analyses failed")
    
    # Test payment
    print("\n💳 PAYMENT TESTS")
    print("-" * 30)
    
    if not tester.test_create_checkout():
        print("❌ Payment checkout failed")
    
    # Test security
    print("\n🔒 SECURITY TESTS")
    print("-" * 30)
    
    if not tester.test_unauthorized_access():
        print("❌ Unauthorized access test failed")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check details above.")
        
        # Print failed tests summary
        failed_tests = [t for t in tester.test_results if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['name']}: {test['message']}")
        
        return 1

if __name__ == "__main__":
    sys.exit(main())