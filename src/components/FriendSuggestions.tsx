import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Stack,
  Avatar,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SchoolIcon from "@mui/icons-material/School";
import { auth, db } from "../services/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

interface User {
  id: string;
  name: string;
  preferences: string[];
  collegeYear: string;
}

const FriendSuggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [sendingRequest, setSendingRequest] = useState<{
    [id: string]: boolean;
  }>({});
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(
    new Set()
  );
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSuggestions = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Step 1: Fetch pending friend requests
      const requestsQuery = query(
        collection(db, "friendRequests"),
        where("senderId", "==", user.uid),
        where("status", "==", "pending")
      );
      const requestSnapshot = await getDocs(requestsQuery);
      const pendingIds = new Set(
        requestSnapshot.docs.map((doc) => doc.data().receiverId)
      );
      setPendingRequests(pendingIds);

      // Step 2: Fetch friends of the current user
      const friendsQuery = query(
        collection(db, "friends"),
        where("user1Id", "==", user.uid)
      );
      const friendsSnapshot = await getDocs(friendsQuery);
      const friendsIdsSet = new Set(
        friendsSnapshot.docs.map((doc) => doc.data().user2Id)
      );
      setFriendIds(friendsIdsSet);

      // Step 3: Fetch users with matching preferences and apply filtering
      const userDoc = await getDocs(collection(db, "profiles"));
      const currentUserPreferences = userDoc.docs
        .find((doc) => doc.id === user.uid)
        ?.data().preferences;

      const userQuery = query(
        collection(db, "profiles"),
        where("preferences", "array-contains-any", currentUserPreferences)
      );
      const suggestionSnapshot = await getDocs(userQuery);

      const suggestedUsers = suggestionSnapshot.docs
        .filter((doc) => !friendsIdsSet.has(doc.id) && doc.id !== user.uid) // Exclude friends and the current user
        .map((doc) => ({ id: doc.id, ...doc.data() })) as User[];

      setSuggestions(suggestedUsers);
    };

    fetchSuggestions();
  }, []);

  const handleSendFriendRequest = async (receiverId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setSendingRequest((prev) => ({ ...prev, [receiverId]: true }));

    try {
      await addDoc(collection(db, "friendRequests"), {
        senderId: user.uid,
        receiverId,
        status: "pending",
        createdAt: new Date(),
      });

      // Add the receiver ID to the pendingRequests set
      setPendingRequests((prev) => new Set(prev).add(receiverId));
    } catch (error) {
      console.error("Error sending friend request:", error);
    } finally {
      setSendingRequest((prev) => ({ ...prev, [receiverId]: false }));
    }
  };

  return (
    <Box>
      {suggestions.length === 0 && (
        <Typography
          variant="body1"
          color="#CC0033"
          textAlign="center"
          sx={{ marginTop: 3 }}
        >
          No suggestions available at the moment. Make sure to add your
          preferences in the profile section!
        </Typography>
      )}
      <Grid container spacing={3}>
        {suggestions.map((user) => (
          <Grid item xs={12} key={user.id}>
            <Card
              sx={{
                display: "flex",
                alignItems: "center",
                boxShadow: 2,
                padding: 2,
              }}
            >
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  backgroundColor: "#CC0033",
                  marginRight: 2,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  {user.name}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ marginTop: 1 }}
                >
                  <SchoolIcon sx={{ color: "#757575" }} />
                  <Typography variant="body2" color="textSecondary">
                    {user.collegeYear}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ marginTop: 1 }}>
                  Preferences: {user.preferences.join(", ")}
                </Typography>
              </CardContent>

              {/* Display Pending or Add Friend button */}
              {pendingRequests.has(user.id) ? (
                <Button variant="outlined" disabled>
                  Pending
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  sx={{ borderColor: "#CC0033", color: "#CC0033" }}
                  onClick={() => handleSendFriendRequest(user.id)}
                  disabled={sendingRequest[user.id]}
                >
                  {sendingRequest[user.id] ? "Sending..." : "Add Friend"}
                </Button>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default FriendSuggestions;
