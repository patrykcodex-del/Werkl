import React from 'react';

const UserProfile: React.FC<{ user: { name: string; email: string; bio: string } }> = ({ user }) => {
    return (
        <div className="user-profile">
            <h2>{user.name}</h2>
            <p>Email: {user.email}</p>
            <p>Bio: {user.bio}</p>
        </div>
    );
};

export default UserProfile;