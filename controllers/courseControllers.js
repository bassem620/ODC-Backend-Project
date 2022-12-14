const asyncHandler = require("express-async-handler");
const Course = require("../models/courseModel");
const Student = require("../models/studentModel");
const Partner = require("../models/partnerModel");

// @desc   Get all courses data
// @route  GET /api/courses/
// @access Public
const getAllCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find({});
    // check for courses data
    if (!courses) {
        res.status(400);
        throw new Error("Invalid courses data");
    }
    const data = courses;
    data.forEach((course) => {
        course.courseProgress = progressPerentage(
            course.startDate,
            course.endDate
        );
    });
    res.status(200).json(data);
});

// @desc   Add new course
// @route  POST /api/courses/
// @access Private (super admins and admins only)
const addCourse = asyncHandler(async (req, res) => {
    // check for admin's role
    if (
        req.admin.authority !== "super admin" &&
        req.admin.authority !== "owner" &&
        req.admin.authority !== "admin"
    ) {
        res.status(400);
        throw new Error("Not authorized to add course");
    }
    const {
        code,
        name,
        desc,
        category,
        skills,
        prerequisiteCourses,
        partner,
        moneyPaid,
        toPay,
        location,
        startDate,
        endDate,
    } = req.body;
    // check for course
    const courseExists = await Course.findOne({ code });
    if (courseExists) {
        res.status(400);
        throw new Error("Course already exists");
    }
    // pre skills
    const preSkills = [];
    for (let i = 0; i < prerequisiteCourses.length; i++) {
        const c = await Course.findOne({ code: prerequisiteCourses[i] });
        preSkills.push(...c.skills);
    }
    // create course
    const course = await Course.create({
        admin: req.admin.username,
        code,
        name,
        desc,
        category,
        skills,
        prerequisiteSkills: preSkills,
        prerequisiteCourses,
        partner,
        moneyPaid,
        toPay,
        location,
        startDate,
        endDate,
        courseProgress: 0,
    });
    // partner
    const partnerData = await Partner.findOne({ name: partner });
    // check for partner
    let partnerUpdated;
    if (!partnerData) {
        partnerUpdated = await Partner.create({
            name: partner,
            courses: [course._id],
            moneyPaid: moneyPaid,
            moneyToPay: toPay,
        });
    } else {
        const updatedMoneyPaid = partnerData.moneyPaid + moneyPaid;
        const updatedMoneyToPay = partnerData.moneyToPay + toPay;
        const updatedCourses = [...partnerData.courses, course._id];
        const updatedData = {
            courses: updatedCourses,
            moneyPaid: updatedMoneyPaid,
            moneyToPay: updatedMoneyToPay,
        };
        partnerUpdated = await Partner.findOneAndUpdate(
            { name: partner },
            updatedData
        );
    }
    // check for updated partner
    if (!partnerUpdated) {
        res.status(400);
        throw new Error("Partner data cannot be updated");
    }
    // check for course
    if (course) {
        res.status(200).json({
            _id: course._id,
            admin: course.admin,
            code: course.code,
            name: course.name,
            desc: course.desc,
            category: course.category,
            skills: course.skills,
            prerequisiteSkills: course.prerequisiteSkills,
            prerequisiteCourses: course.prerequisiteCourses,
            enrolledStudents: [],
            partner: course.partner,
            moneyPaid: course.moneyPaid,
            toPay: course.toPay,
            location: course.location,
            startDate: course.startDate,
            endDate: course.endDate,
            visited: [],
            courseProgress: progressPerentage(course.startDate, course.endDate),
        });
    } else {
        res.status(400);
        throw new Error("Invalid course data");
    }
});

// @desc   Get specific course data
// @route  GET /api/courses/:id
// @access Public
const getCourse = asyncHandler(async (req, res) => {
    // check if course exists
    const course = await Course.findById(req.params.id);
    // check for courses data
    if (!course) {
        res.status(400);
        throw new Error("Course does not exists");
    }
    const data = course;
    data.courseProgress = progressPerentage(course.startDate, course.endDate);
    res.status(200).json(data);
});

// @desc   Update course data
// @route  PATCH /api/courses/:id
// @access Private (super admins and admins only)
const updataCourse = asyncHandler(async (req, res) => {
    // check for admin's role
    if (
        req.admin.authority !== "super admin" &&
        req.admin.authority !== "owner" &&
        req.admin.authority !== "admin"
    ) {
        res.status(400);
        throw new Error("Not authorized to add course");
    }
    // check if course exists
    const course = await Course.findById(req.params.id);
    if (!course) {
        res.status(400);
        throw new Error("Course does not exists");
    }
    // check if one side of the money data exists
    if (
        (req.body.moneyPaid && !req.body.toPay) ||
        (!req.body.moneyPaid && req.body.toPay)
    ) {
        res.status(400);
        throw new Error("Cannot change one side of money data");
    }
    // update money data
    if (req.body.moneyPaid && req.body.toPay) {
        const partner = await Partner.findOne({ name: course.partner });
        const moneyUpdated = await Partner.findOneAndUpdate(
            { name: course.partner },
            {
                moneyPaid:
                    partner.moneyPaid -
                    course.moneyPaid +
                    parseInt(req.body.moneyPaid),
                moneyToPay:
                    partner.moneyToPay -
                    course.toPay +
                    parseInt(req.body.toPay),
            }
        );
        if (!moneyUpdated) {
            res.status(400);
            throw new Error("Money data couldn't update");
        }
    }
    // update course
    const updatedCourse = await Course.findByIdAndUpdate(
        req.params.id,
        req.body
    );
    // check for updated data
    if (!updatedCourse) {
        res.status(400);
        throw new Error("Course couldn't update");
    }
    const newData = await Course.findById(req.params.id);
    // check for course data
    if (!newData) {
        res.status(400);
        throw new Error("Invalid course data");
    }
    res.status(200).json(newData);
});

// @desc   Delete course
// @route  DELETE /api/courses/:id
// @access Private (super admins and admins only)
const deleteCourse = asyncHandler(async (req, res) => {
    // check for admin's role
    if (
        req.admin.authority !== "super admin" &&
        req.admin.authority !== "owner" &&
        req.admin.authority !== "admin"
    ) {
        res.status(400);
        throw new Error("Not authorized to add course");
    }
    // check if course exists
    const course = await Course.findById(req.params.id);
    if (!course) {
        res.status(400);
        throw new Error("Course does not exists");
    }
    // check for money not paid
    if (course.toPay !== 0) {
        // disable course
        const disabled = await Course.findByIdAndUpdate(req.params.id, {
            disabled: true,
        });
        // check for disabled course
        if (!disabled) {
            res.status(400);
            throw new Error("Couldn't disable course");
        }
        res.status(200).json({
            message: "Course is only disabled due to unpaid money",
            id: req.params.id,
        });
        return;
    }
    // delete course
    const deleted = await Course.findByIdAndDelete(req.params.id);
    // check for deleted course
    if (!deleted) {
        res.status(400);
        throw new Error("Couldn't delete course");
    }
    res.status(200).json({
        message: "Course deleted",
        id: req.params.id,
    });
});

// @desc   Get recommended courses based on logged student
// @route  GET /api/courses/recommended
// @access Public
const recommended = asyncHandler(async (req, res) => {
    const FRONTEND = ["CS111", "FR111", "FR112", "FR113"];
    const BACKEND = ["CS111", "BK111", "BK112", "BK113"];
    const student = await Student.findById(req.params.id);
    const courses = student.specialty === "Frontend" ? FRONTEND : BACKEND;
    const joined = student.joinedCourses.map((c) => c.courseCode);
    const notJoinedCourses = courses.filter(
        (course) => !joined.includes(course)
    );
    // check if the student finished all his specialty courses
    if (notJoinedCourses.length === 0) {
        res.status(400);
        throw new Error("Student has finished all his specialty courses");
    }
    const lastCourse = await Course.findOne({
        code: student.joinedCourses[joined.length - 1].courseCode,
    }).select("code name desc location startDate endDate");
    const nextCourse = await Course.findOne({
        code: notJoinedCourses[0],
    }).select("code name desc location startDate endDate");
    // New student
    if (student.joinedCourses.length === 0) {
        const course = await Course.findOne({ code: "CS111" });
        res.status(200).json(course);
        return;
    }
    // Intersecting courses
    if (
        student.joinedCourses[joined.length - 1].progress !== "attended" &&
        nextCourse.startDate.getTime() < lastCourse.endDate.getTime()
    ) {
        res.status(400);
        throw new Error(
            "Student is attending a course intersecting with the expected next course."
        );
    }
    // check for last course quiz
    if (student.joinedCourses[joined.length - 1].quiz === null) {
        res.status(200).json({
            message: "You need to pass last course exam",
            course: lastCourse,
        });
        return;
    }
    // Check if the user deserves
    if (student.joinedCourses[joined.length - 1].quiz < 5) {
        res.status(200).json({
            message: "You need to re-check last course",
            course: lastCourse,
        });
        return;
    }
    // upcoming recommended course
    if (
        student.joinedCourses[joined.length - 1].quiz >= 5 &&
        student.joinedCourses[joined.length - 1].progress === "attended"
    ) {
        res.status(200).json(nextCourse);
        return;
    }
});

// @desc   Get money details of courses
// @route  GET /api/courses/money
// @access Private
const moneyData = asyncHandler(async (req, res) => {
    // code name partner location moneyPaid toPay
    const courses = await Course.find(
        {},
        "code name partner location moneyPaid toPay courseProgress  startDate endDate"
    );
    // check for courses
    if (!courses) {
        res.status(400);
        throw new Error("There is no courses found");
    }
    // partners money data
    const partnersMoneyData = await Partner.find({});
    // ODC money data
    let moneyPaid = 0;
    let moneyToPay = 0;
    partnersMoneyData.forEach((one) => {
        moneyPaid += one.moneyPaid;
        moneyToPay += one.moneyToPay;
    });
    // progress for each course
    const data = courses;
    data.forEach((course) => {
        course.courseProgress = progressPerentage(
            course.startDate,
            course.endDate
        );
    });
    res.status(200).json({
        moneyPaid,
        moneyToPay,
        total: moneyPaid + moneyToPay,
        partners: partnersMoneyData,
        courses: data,
    });
});

// Get course progress percentage function
const progressPerentage = (startDate, endDate) => {
    const start = startDate.getTime();
    const end = endDate.getTime();
    const now = new Date();
    const totalDays = (end - start) / 1000 / 60 / 60 / 24;
    const daysLeft = (end - now.getTime()) / 1000 / 60 / 60 / 24;
    const progress = parseInt(((totalDays - daysLeft) / totalDays) * 100);
    if (progress < 0) return 0;
    if (progress > 100) return 100;
    return progress;
};

module.exports = {
    getAllCourses,
    addCourse,
    getCourse,
    updataCourse,
    deleteCourse,
    recommended,
    moneyData,
};
