from app import create_app

app = create_app()

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  DOCEXPO — AI Document Intelligence Platform")
    print("  Server running at: http://127.0.0.1:5000")
    print("=" * 60 + "\n", flush=True)
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, threaded=True)
