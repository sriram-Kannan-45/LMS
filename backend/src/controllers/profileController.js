const { User, TrainerProfile } = require('../models');

const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dob, phone, address, qualification, experience, name } = req.body;

    // Update user name if provided
    if (name) {
      await User.update({ name }, { where: { id: userId } });
    }

    let profile = await TrainerProfile.findOne({ where: { userId } });
    
    const imagePath = req.file ? req.file.filename : null;

    if (profile) {
      await profile.update({
        dob: dob || profile.dob,
        phone: phone || profile.phone,
        address: address || profile.address,
        qualification: qualification || profile.qualification,
        experience: experience || profile.experience,
        imagePath: imagePath || profile.imagePath
      });
    } else {
      profile = await TrainerProfile.create({
        userId,
        dob,
        phone,
        address,
        qualification,
        experience,
        imagePath
      });
    }

    // Fetch updated profile with user details
    const updatedProfile = await TrainerProfile.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'username']
      }]
    });

    res.json({ 
      success: true,
      message: profile.id ? 'Profile updated successfully' : 'Profile created successfully',
      profile: {
        id: updatedProfile.id,
        userId: updatedProfile.userId,
        dob: updatedProfile.dob,
        phone: updatedProfile.phone,
        address: updatedProfile.address,
        qualification: updatedProfile.qualification,
        experience: updatedProfile.experience,
        imagePath: updatedProfile.imagePath,
        user: updatedProfile.user
      }
    });
  } catch (error) {
    console.error('Profile save error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Server error saving profile' });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await TrainerProfile.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'username']
      }]
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({ 
      success: true,
      profile 
    });
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching profile' });
  }
};

const getAllTrainers = async (req, res) => {
  try {
    const trainers = await User.findAll({
      where: { role: 'TRAINER' },
      attributes: ['id', 'name', 'email', 'username'],
      include: [{
        model: TrainerProfile,
        as: 'profile',
        attributes: ['dob', 'phone', 'address', 'qualification', 'experience', 'imagePath']
      }]
    });

    res.json({ 
      success: true,
      trainers 
    });
  } catch (error) {
    console.error('Get trainers error:', error.message);
    res.status(500).json({ success: false, error: 'Server error fetching trainers' });
  }
};

const updateProfile = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    const imageUrl = req.file ? req.file.path : null;

    await User.update(
      {
        phone: req.body.phone,
        dob: req.body.dob,
        profilePic: imageUrl
      },
      { where: { id: req.user.id } }
    );

    res.json({
      success: true,
      message: "Profile updated",
      imageUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getProfile,
  getAllTrainers,
  updateProfile
};