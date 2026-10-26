BEGIN;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    identification_number VARCHAR(40) NOT NULL UNIQUE,
    birth_date DATE NOT NULL,
    phone VARCHAR(25) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_user_profiles_identification_number
    ON user_profiles (identification_number);

COMMIT;
