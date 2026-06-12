from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import models
import schemas
import auth
from database import get_db

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user (retailer, supplier, or admin).
    If registering as a supplier, a 'brand_name' must be provided.
    """
    # 1. Check if email already exists
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )
    
    # 2. Validate supplier parameters
    if user_data.role == "supplier" and not user_data.brand_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suppliers must provide a 'brand_name'."
        )
    
    # 3. Hash the password
    hashed_pw = auth.get_password_hash(user_data.password)
    
    # 4. Create database user record
    new_user = models.User(
        email=user_data.email,
        hashed_password=hashed_pw,
        role=user_data.role,
        brand_name=user_data.brand_name if user_data.role == "supplier" else None
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Standard OAuth2 Login endpoint.
    Accepts standard form fields: 'username' (which is the email) and 'password'.
    Returns a Bearer JWT Token.
    """
    # Find user by email (form_data.username)
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create the access token payload
    token_payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": user.role
    }
    
    access_token = auth.create_access_token(data=token_payload)
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """
    Retrieve user information for the currently authenticated session.
    """
    return current_user
