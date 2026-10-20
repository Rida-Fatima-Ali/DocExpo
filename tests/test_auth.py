import unittest
from config import TestingConfig
from app import create_app
from app.extensions import db
from app.models.models import User

class AuthTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestingConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_registration_success(self):
        res = self.client.post('/api/auth/register', json={
            'full_name': 'Test User',
            'email': 'test@documind.io',
            'password': 'password123',
            'confirm_password': 'password123'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['user']['email'], 'test@documind.io')
        
        # Verify in DB
        user = User.query.filter_by(email='test@documind.io').first()
        self.assertIsNotNone(user)
        self.assertTrue(user.check_password('password123'))
        self.assertNotEqual(user.password_hash, 'password123')

    def test_registration_duplicate_email(self):
        self.client.post('/api/auth/register', json={
            'full_name': 'First User',
            'email': 'dup@documind.io',
            'password': 'password123',
            'confirm_password': 'password123'
        })
        # Try duplicate
        res = self.client.post('/api/auth/register', json={
            'full_name': 'Second User',
            'email': 'dup@documind.io',
            'password': 'password123',
            'confirm_password': 'password123'
        })
        self.assertEqual(res.status_code, 409)

    def test_registration_validation(self):
        # Mismatched passwords
        res = self.client.post('/api/auth/register', json={
            'full_name': 'User',
            'email': 'user@documind.io',
            'password': 'password123',
            'confirm_password': 'different_password'
        })
        self.assertEqual(res.status_code, 400)

        # Short password
        res = self.client.post('/api/auth/register', json={
            'full_name': 'User',
            'email': 'user@documind.io',
            'password': '123',
            'confirm_password': '123'
        })
        self.assertEqual(res.status_code, 400)

    def test_login_and_logout(self):
        self.client.post('/api/auth/register', json={
            'full_name': 'Login Tester',
            'email': 'login@documind.io',
            'password': 'securepassword',
            'confirm_password': 'securepassword'
        })

        # Correct login
        res = self.client.post('/api/auth/login', json={
            'email': 'login@documind.io',
            'password': 'securepassword'
        })
        self.assertEqual(res.status_code, 200)

        # Me endpoint
        me_res = self.client.get('/api/auth/me')
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.get_json()['user']['email'], 'login@documind.io')

        # Logout
        logout_res = self.client.post('/api/auth/logout')
        self.assertEqual(logout_res.status_code, 200)

        # Me should now fail
        me_after = self.client.get('/api/auth/me')
        self.assertEqual(me_after.status_code, 401)

    def test_invalid_login(self):
        res = self.client.post('/api/auth/login', json={
            'email': 'nonexistent@documind.io',
            'password': 'wrong'
        })
        self.assertEqual(res.status_code, 401)

if __name__ == '__main__':
    unittest.main()
