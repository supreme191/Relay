from api.models import User, ChatMessage, Profile
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer): 
 
    class Meta: 
        model = User 
        fields = ('id', 'username', 'email') 


 
class RegisterSerializer(serializers.ModelSerializer): 
    password = serializers.CharField( 
        write_only=True, required=True, validators=[validate_password]) 
    password2 = serializers.CharField(write_only=True, required=True) 
 
    class Meta: 
        model = User 
        fields = ('email', 'username', 'password', 'password2') 
 
    def validate(self, attrs): 
        if attrs['password'] != attrs['password2']: 
            raise serializers.ValidationError( 
                {"password": "Password fields didn't match."}) 
 
        return attrs 
 
    def create(self, validated_data): 
        user = User.objects.create( 
            username=validated_data['username'], 
            email=validated_data['email'] 
        ) 
 
        user.set_password(validated_data['password']) 
        user.save() 
 
        return user 
 


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["username"] = user.username
        token["email"] = user.email

        return token



class ProfileSerializer(serializers.ModelSerializer): 
 
    class Meta: 
        model = Profile 
        fields = [ 'id',  'user',  'full_name', 'bio', 'image' ] 
     
    def __init__(self, *args, **kwargs): 
        super(ProfileSerializer, self).__init__(*args, **kwargs) 
        request = self.context.get('request') 
        if request and request.method=='POST': 
            self.Meta.depth = 0 
        else: 
            self.Meta.depth = 3 

 
 
class MessageSerializer(serializers.ModelSerializer): 
    reciever_profile = ProfileSerializer(read_only=True) 
    sender_profile = ProfileSerializer(read_only=True) 
 
    class Meta: 
        model = ChatMessage 
        fields = ['id','sender', 'reciever', 'reciever_profile', 'sender_profile' ,'message', 'is_read', 'date'] 
     
    def __init__(self, *args, **kwargs): 
        super(MessageSerializer, self).__init__(*args, **kwargs) 
        request = self.context.get('request') 
        if request and request.method=='POST': 
            self.Meta.depth = 0 
        else: 
            self.Meta.depth = 2 
 
 
