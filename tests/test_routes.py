import unittest
from config import TestingConfig
from app import create_app
from app.extensions import db
from app.models.models import User, Document

class RoutesTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestingConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # User A
        self.user_a = User(full_name="Alice User", email="alice@documind.io")
        self.user_a.set_password("alicepass")
        # User B
        self.user_b = User(full_name="Bob User", email="bob@documind.io")
        self.user_b.set_password("bobpass")
        db.session.add_all([self.user_a, self.user_b])
        db.session.commit()

        # Document owned by User A
        self.doc_a = Document(
            user_id=self.user_a.id,
            original_filename="Alice_Confidential.pdf",
            stored_filename="alice_conf.pdf",
            file_size=1024,
            page_count=2,
            processing_status='processed'
        )
        db.session.add(self.doc_a)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_landing_page(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Understand every document", res.data)

    def test_unauthenticated_access_blocked(self):
        # API requires auth
        res_api = self.client.get('/api/documents')
        self.assertEqual(res_api.status_code, 401)

        # Page redirects to login
        res_page = self.client.get('/dashboard')
        self.assertEqual(res_page.status_code, 302)
        self.assertIn('/login', res_page.headers['Location'])

    def test_cross_user_isolation(self):
        # Log in as User B
        with self.client:
            self.client.post('/api/auth/login', json={'email': 'bob@documind.io', 'password': 'bobpass'})

            # User B attempts to access User A's document via API
            res_get = self.client.get(f'/api/documents/{self.doc_a.id}')
            self.assertEqual(res_get.status_code, 404)

            # User B attempts to delete User A's document
            res_del = self.client.delete(f'/api/documents/{self.doc_a.id}')
            self.assertEqual(res_del.status_code, 404)

            # User B attempts to download User A's file
            res_file = self.client.get(f'/documents/{self.doc_a.id}/file')
            self.assertEqual(res_file.status_code, 404)

            # User B's document list should be empty
            res_list = self.client.get('/api/documents')
            self.assertEqual(res_list.status_code, 200)
            data = res_list.get_json()
            self.assertEqual(len(data['documents']), 0)

    def test_dashboard_stats_calculation(self):
        # Log in as User A
        with self.client:
            self.client.post('/api/auth/login', json={'email': 'alice@documind.io', 'password': 'alicepass'})

            res = self.client.get('/api/dashboard/stats')
            self.assertEqual(res.status_code, 200)
            stats = res.get_json()['stats']
            self.assertEqual(stats['total_documents'], 1)
            self.assertEqual(stats['total_pages_processed'], 2)
            self.assertEqual(stats['total_storage_bytes'], 1024)

    def test_theme_and_password_update(self):
        with self.client:
            self.client.post('/api/auth/login', json={'email': 'alice@documind.io', 'password': 'alicepass'})

            # Theme change
            theme_res = self.client.post('/api/auth/theme', json={'theme': 'dark'})
            self.assertEqual(theme_res.status_code, 200)
            user_db = db.session.get(User, self.user_a.id)
            self.assertEqual(user_db.theme_preference, 'dark')

            # Password change
            pwd_res = self.client.post('/api/auth/change-password', json={
                'current_password': 'alicepass',
                'new_password': 'newalicepass123',
                'confirm_new_password': 'newalicepass123'
            })
            self.assertEqual(pwd_res.status_code, 200)
            db.session.refresh(user_db)
            self.assertTrue(user_db.check_password('newalicepass123'))

if __name__ == '__main__':
    unittest.main()
